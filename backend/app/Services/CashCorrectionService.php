<?php

namespace App\Services;

use App\Models\AccountReset;
use App\Models\AdminAuditLog;
use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Annullamento di un'entrata o un'uscita di cassa registrata per sbaglio.
 * Non cancella nulla: il movimento resta "annullato" e nasce un movimento opposto che lo compensa.
 */
class CashCorrectionService
{
    private const INTERNAL_TYPES = ['annullamento', 'utilizzo_accredito', DebtService::REASSIGNMENT_CREDIT_TYPE, DebtService::BONUS_CREDIT_TYPE];

    public function __construct(private CashService $cashService, private DebtService $debtService) {}

    /** Perche questo movimento non si puo annullare dalla cassa (null = si puo). */
    public function blockReason(CashMovement $movement): ?string
    {
        return match (true) {
            $movement->status !== 'active' => 'Movimento già annullato.',
            (bool) $movement->is_opening_historical_record,
            in_array($movement->type, ['saldo_iniziale', 'apertura_cassa'], true) || $movement->category === 'apertura',
            AccountReset::query()->where('opening_cash_movement_id', $movement->id)->exists() => 'È il saldo di apertura della cassa: non si annulla.',
            in_array($movement->type, self::INTERNAL_TYPES, true) || ! $movement->affects_current_balance => 'Movimento interno collegato ad altre operazioni: non si annulla da solo.',
            $movement->withdrawal_id !== null => 'È il pagamento di un prelievo: correggilo da Gestione › Riassegna prelievi.',
            $movement->cash_loan_id !== null => 'È un prestito dalla cassa: gestiscilo da Debiti › Prestiti dalla cassa.',
            $movement->debt_payment_id !== null => 'È il pagamento di un coppone: non si annulla dalla cassa.',
            $movement->type === DebtService::SHORTFALL_CASH_TYPE => 'È un coppone collettivo: i copponi dei soci restano aperti, non si annulla dalla cassa.',
            default => null,
        };
    }

    /** Carichi di magazzino nati insieme a questo movimento (uscita con prodotto o spesa registrata). */
    public function stockLoads(CashMovement $movement): Collection
    {
        return InventoryMovement::query()
            ->with('product:id,name,unit')
            ->where('cash_movement_id', $movement->id)
            ->where('status', 'active')
            ->whereIn('type', ['acquisto', 'rifornimento'])
            ->get();
    }

    public function cancel(CashMovement $movement, User $admin, string $reason, bool $removeStock): CashMovement
    {
        return DB::transaction(function () use ($movement, $admin, $reason, $removeStock) {
            $locked = CashMovement::query()->whereKey($movement->id)->lockForUpdate()->firstOrFail();
            if ($block = $this->blockReason($locked)) {
                throw new RuntimeException($block);
            }

            // Un accredito già usato per pagare copponi non si può più togliere.
            if ($locked->type === 'accredito' && $locked->member_id) {
                $member = User::query()->findOrFail($locked->member_id);
                if ($this->debtService->walletCreditCents($member) < (int) $locked->amount_cents) {
                    throw new RuntimeException("L'accredito di {$member->name} è già stato usato per pagare dei copponi: non si può annullare.");
                }
            }

            $stock = [];
            if ($removeStock) {
                foreach ($this->stockLoads($locked) as $load) {
                    $product = Product::query()->whereKey($load->product_id)->lockForUpdate()->firstOrFail();
                    $previous = (float) $product->current_quantity;
                    $resulting = $previous - (float) $load->quantity;
                    if ($resulting < 0) {
                        throw new RuntimeException("Non posso togliere «{$product->name}» dal magazzino: ne restano meno di quanti ne erano stati caricati.");
                    }
                    $product->update(['current_quantity' => $resulting]);
                    $load->update(['status' => 'reversed']);
                    InventoryMovement::create([
                        'product_id' => $product->id,
                        'user_id' => $admin->id,
                        'reverses_movement_id' => $load->id,
                        'type' => 'annullamento',
                        'quantity' => (float) $load->quantity,
                        'previous_quantity' => $previous,
                        'resulting_quantity' => $resulting,
                        'note' => "Annullamento cassa #{$locked->id}: {$reason}",
                    ]);
                    $stock[] = ['product_id' => $product->id, 'quantity' => (float) $load->quantity];
                }

            }

            // Uscita di una spesa registrata: lo scontrino resta visibile come annullato e non conta più nei totali.
            if ($locked->type === 'acquisto_prodotti' && preg_match('/^Spesa prodotti #(\d+)$/', (string) $locked->description, $match)) {
                RestockSession::query()->whereKey($match[1])->update(['status' => 'cancelled']);
            }

            $reversal = $this->cashService->reverse($locked, $admin);
            $reversal->update(['note' => $reason, 'description' => 'Annullamento: '.($locked->description ?: $locked->type)]);

            AdminAuditLog::create([
                'admin_id' => $admin->id,
                'target_user_id' => $locked->member_id,
                'action' => 'cash_movement_cancelled',
                'changes' => [
                    'cash_movement_id' => $locked->id,
                    'direction' => $locked->direction,
                    'amount_cents' => (int) $locked->amount_cents,
                    'reason' => $reason,
                    'stock_removed' => $stock,
                ],
            ]);

            return $reversal->fresh();
        });
    }
}
