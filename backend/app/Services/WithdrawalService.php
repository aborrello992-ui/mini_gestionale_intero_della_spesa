<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WithdrawalService
{
    public function __construct(private CashService $cashService, private DebtService $debtService) {}

    /**
     * Opzioni (per i prelievi inseriti a mano dall'admin):
     * - withdrawn_at: data/ora reale del prelievo (default adesso)
     * - affects_stock: false se il magazzino era gia stato scalato
     * - is_manual: segna il prelievo come inserito a mano
     * - total_cents, sale_id, combo_id: quota di una vendita combo o divisa (SaleService)
     */
    public function take(Product $product, User $member, User $actor, float $quantity, string $paymentStatus, ?string $notes = null, array $options = []): Withdrawal
    {
        $withdrawnAt = $options['withdrawn_at'] ?? now();
        $affectsStock = $options['affects_stock'] ?? true;

        if (! in_array($paymentStatus, ['paid', 'coppone'], true)) {
            throw new RuntimeException('Modalita pagamento non valida.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('La quantita deve essere maggiore di zero.');
        }

        // Ospite: serve un socio garante; il pagamento resta da verificare finche un admin non lo conferma.
        $sponsor = null;
        if ($member->isGuest()) {
            if ($paymentStatus === 'coppone') {
                throw new RuntimeException("{$member->name} è un ospite: paga subito, niente coppone.");
            }
            $sponsor = $options['sponsor'] ?? null;
            if (! $sponsor instanceof User || $sponsor->isGuest()) {
                throw new RuntimeException("{$member->name} è un ospite: serve un socio garante che confermi con il suo PIN.");
            }
            $paymentStatus = Withdrawal::PAYMENT_PENDING;
        }

        return DB::transaction(function () use ($product, $member, $actor, $quantity, $paymentStatus, $notes, $withdrawnAt, $affectsStock, $options, $sponsor) {
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $previous = (float) $locked->current_quantity;
            $resulting = $affectsStock ? $previous - $quantity : $previous;

            if ($resulting < 0) {
                throw new RuntimeException("Non basta «{$locked->name}»: ne restano ".rtrim(rtrim(number_format($previous, 3, ',', ''), '0'), ',').'.');
            }

            $unitPrice = $locked->selling_price_cents ?: $locked->average_price_cents;
            $total = (int) round($quantity * $unitPrice);
            if (isset($options['total_cents'])) {
                // Quota di una combo o di una spesa divisa: l'importo e gia stato ripartito.
                $total = (int) $options['total_cents'];
                $unitPrice = (int) round($total / $quantity);
            }

            $withdrawal = Withdrawal::create([
                'user_id' => $member->id,
                'product_id' => $locked->id,
                'created_by' => $actor->id,
                'quantity' => $quantity,
                'unit_price_cents' => $unitPrice,
                'total_amount_cents' => $total,
                'payment_status' => $paymentStatus,
                'withdrawn_at' => $withdrawnAt,
                'notes' => $notes,
                'is_manual' => (bool) ($options['is_manual'] ?? false),
                'sale_id' => $options['sale_id'] ?? null,
                'combo_id' => $options['combo_id'] ?? null,
                'affects_stock' => $affectsStock,
                'sponsor_id' => $sponsor?->id,
            ]);

            if ($affectsStock) {
                $locked->update(['current_quantity' => $resulting]);
            }

            $inventoryMovement = InventoryMovement::create([
                'product_id' => $locked->id,
                'user_id' => $member->id,
                'withdrawal_id' => $withdrawal->id,
                'type' => match ($paymentStatus) {
                    'paid' => 'prelievo_pagato',
                    Withdrawal::PAYMENT_PENDING => 'prelievo_ospite',
                    default => 'prelievo_coppone',
                },
                'quantity' => $quantity,
                'previous_quantity' => $previous,
                'resulting_quantity' => $resulting,
                'unit_price_cents' => $unitPrice,
                'total_amount_cents' => $total,
                'note' => $notes,
            ]);

            if ($total <= 0 || $paymentStatus === Withdrawal::PAYMENT_PENDING) {
                // Quota a costo zero, oppure acquisto di un ospite: il denaro si registra alla verifica.
            } elseif ($paymentStatus === 'paid') {
                $cashMovement = $this->cashService->createFromCents([
                    'amount_cents' => $total,
                    'direction' => 'entrata',
                    'type' => 'prodotto_pagato',
                    'category' => 'prodotti',
                    'description' => "Pagamento {$locked->name}",
                    'movement_date' => $withdrawnAt->toDateString(),
                    'movement_time' => $withdrawnAt->format('H:i:s'),
                    'member_id' => $member->id,
                    'product_id' => $locked->id,
                    'withdrawal_id' => $withdrawal->id,
                    'note' => $notes,
                ], $actor);

                $inventoryMovement->update(['cash_movement_id' => $cashMovement->id]);
            } else {
                MemberDebt::create([
                    'withdrawal_id' => $withdrawal->id,
                    'user_id' => $member->id,
                    'original_amount_cents' => $total,
                    'remaining_amount_cents' => $total,
                    'notes' => $notes,
                ]);

                $this->debtService->applyWalletCreditToOpenDebts($member, $actor, 'Credito usato per il nuovo coppone');
            }

            return $withdrawal->load('member:id,name,avatar_path', 'product');
        });
    }

    /**
     * Sposta un prelievo su un altro socio senza cancellare nulla.
     * Pagato: cambia solo il socio collegato (la cassa non cambia).
     * Coppone non pagato: il debito passa al nuovo socio.
     * Coppone gia pagato (anche in parte): il vecchio debito viene chiuso come "riassegnato",
     * quanto gia versato torna al vecchio socio come credito e il nuovo socio riceve un debito pieno.
     */
    public function reassign(Withdrawal $withdrawal, User $newMember, User $admin, string $reason): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal, $newMember, $admin, $reason) {
            $locked = Withdrawal::query()->whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'active') {
                throw new RuntimeException('Non si può riassegnare un prelievo annullato.');
            }
            if ($locked->payment_status === Withdrawal::PAYMENT_PENDING) {
                throw new RuntimeException('Prima verifica il pagamento dell\'ospite in Gestione › Incassi ospiti.');
            }
            if ((int) $locked->user_id === (int) $newMember->id) {
                throw new RuntimeException('Il prelievo è già intestato a questo socio.');
            }

            $oldMember = User::query()->findOrFail($locked->user_id);
            $debtChange = null;

            if ($locked->payment_status === 'coppone') {
                $debt = MemberDebt::query()
                    ->where('withdrawal_id', $locked->id)
                    ->whereIn('status', ['open', 'settled'])
                    ->lockForUpdate()
                    ->first();

                if ($debt && (int) $debt->paid_amount_cents === 0) {
                    $debt->update(['user_id' => $newMember->id]);
                    $debtChange = ['mode' => 'moved', 'debt_id' => $debt->id];
                } elseif ($debt) {
                    $paid = (int) $debt->paid_amount_cents;
                    $debt->update([
                        'status' => 'reassigned',
                        'remaining_amount_cents' => 0,
                        'notes' => trim(($debt->notes ? $debt->notes.' | ' : '')."Riassegnato a {$newMember->name}: {$reason}"),
                    ]);

                    // Il denaro e gia in cassa: il credito restituito non cambia il saldo reale.
                    $this->cashService->createFromCents([
                        'amount_cents' => $paid,
                        'direction' => 'entrata',
                        'type' => DebtService::REASSIGNMENT_CREDIT_TYPE,
                        'category' => 'portafoglio',
                        'description' => "Credito per prelievo #{$locked->id} riassegnato",
                        'movement_date' => now()->toDateString(),
                        'movement_time' => now()->format('H:i:s'),
                        'member_id' => $oldMember->id,
                        'withdrawal_id' => $locked->id,
                        'note' => $reason,
                        'affects_current_balance' => false,
                    ], $admin);

                    $newDebt = MemberDebt::create([
                        'withdrawal_id' => $locked->id,
                        'user_id' => $newMember->id,
                        'original_amount_cents' => (int) $debt->original_amount_cents,
                        'remaining_amount_cents' => (int) $debt->original_amount_cents,
                        'notes' => "Riassegnato da {$oldMember->name}: {$reason}",
                    ]);
                    $debtChange = ['mode' => 'replaced', 'old_debt_id' => $debt->id, 'new_debt_id' => $newDebt->id, 'credit_returned_cents' => $paid];
                }
            }

            $locked->update([
                'user_id' => $newMember->id,
                'original_user_id' => $locked->original_user_id ?? $oldMember->id,
                'reassigned_at' => now(),
                'reassigned_by' => $admin->id,
                'reassign_reason' => $reason,
            ]);
            InventoryMovement::query()->where('withdrawal_id', $locked->id)->update(['user_id' => $newMember->id]);
            CashMovement::query()->where('withdrawal_id', $locked->id)->where('type', 'prodotto_pagato')->update(['member_id' => $newMember->id]);

            AdminAuditLog::create([
                'admin_id' => $admin->id,
                'target_user_id' => $newMember->id,
                'action' => 'withdrawal_reassigned',
                'changes' => [
                    'withdrawal_id' => $locked->id,
                    'from_user_id' => $oldMember->id,
                    'to_user_id' => $newMember->id,
                    'payment_status' => $locked->payment_status,
                    'reason' => $reason,
                    'debt' => $debtChange,
                ],
            ]);

            $this->debtService->applyWalletCreditToOpenDebts($oldMember, $admin, 'Credito usato dopo riassegnazione prelievo');
            $this->debtService->applyWalletCreditToOpenDebts($newMember, $admin, 'Credito usato dopo riassegnazione prelievo');

            return $locked->fresh()->load('member:id,name', 'originalMember:id,name', 'product:id,name,unit', 'debts');
        });
    }

    /**
     * Verifica di un acquisto ospite: "paid" registra l'entrata in cassa,
     * "unpaid" trasforma l'importo in coppone del socio garante.
     */
    public function verifyGuestPayment(Withdrawal $withdrawal, string $outcome, User $admin): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal, $outcome, $admin) {
            $locked = Withdrawal::query()->whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();
            if ($locked->payment_status !== Withdrawal::PAYMENT_PENDING) {
                throw new RuntimeException('Questo acquisto è già stato verificato.');
            }

            $guest = User::query()->findOrFail($locked->user_id);
            $product = Product::query()->find($locked->product_id);
            $total = (int) $locked->total_amount_cents;

            if ($outcome === 'paid') {
                if ($total > 0) {
                    $cash = $this->cashService->createFromCents([
                        'amount_cents' => $total,
                        'direction' => 'entrata',
                        'type' => 'prodotto_pagato',
                        'category' => 'prodotti',
                        'description' => 'Pagamento '.($product?->name ?? 'prodotto')." ({$guest->name})",
                        'movement_date' => now()->toDateString(),
                        'movement_time' => now()->format('H:i:s'),
                        'member_id' => $guest->id,
                        'product_id' => $locked->product_id,
                        'withdrawal_id' => $locked->id,
                        'note' => 'Incasso ospite verificato',
                    ], $admin);
                    InventoryMovement::query()->where('withdrawal_id', $locked->id)->update(['cash_movement_id' => $cash->id]);
                }
                $locked->update(['payment_status' => 'paid']);
            } else {
                $sponsor = User::query()->findOrFail($locked->sponsor_id);
                if ($total > 0) {
                    MemberDebt::create([
                        'withdrawal_id' => $locked->id,
                        'user_id' => $sponsor->id,
                        'original_amount_cents' => $total,
                        'remaining_amount_cents' => $total,
                        'type' => 'garante',
                        'description' => "Garante per {$guest->name}: ".($product?->name ?? 'prodotto'),
                        'notes' => 'Acquisto ospite non pagato',
                    ]);
                    $this->debtService->applyWalletCreditToOpenDebts($sponsor, $admin, 'Credito usato per un acquisto ospite non pagato');
                }
                $locked->update(['payment_status' => 'coppone']);
            }

            $locked->update(['payment_verified_at' => now(), 'payment_verified_by' => $admin->id]);

            return $locked->fresh()->load('member:id,name', 'sponsor:id,name', 'product:id,name,unit');
        });
    }
}
