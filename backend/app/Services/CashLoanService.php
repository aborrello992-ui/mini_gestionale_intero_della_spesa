<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\CashCount;
use App\Models\CashLoan;
use App\Models\CashMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Soldi presi in prestito dalla cassa da un socio. Il saldo dell'app NON cambia (i conti restano interi):
 * cambiano i contanti che devono esserci nel cassetto, che scendono finché il prestito è aperto.
 * Il socio riceve un promemoria a ogni accesso. Non c'entrano con i copponi dei prodotti.
 */
class CashLoanService
{
    public const LEND_TYPE = 'prestito_cassa';

    public const REPAY_TYPE = 'restituzione_prestito';

    public function __construct(private CashService $cashService) {}

    /** Soldi attualmente fuori dal cassetto: prestiti aperti, al netto di quanto già restituito. */
    public function outstandingCents(): int
    {
        return (int) CashLoan::query()->where('status', 'open')->sum(DB::raw('amount_cents - repaid_cents'));
    }

    /**
     * Contanti che dovrebbero esserci nel cassetto adesso, partendo dall'ultimo conteggio fisico.
     * Il saldo dell'app può essere diverso dai contanti veri (es. spese pagate di tasca): per questo non si usa lui.
     * Null se il cassetto non è mai stato contato.
     */
    public function drawerEstimateCents(): ?int
    {
        $latest = CashCount::query()->latest('counted_at')->latest('id')->first();
        if (! $latest) {
            return null;
        }

        return (int) $latest->counted_cents
            + ($this->cashService->balanceCents() - (int) $latest->app_balance_cents)
            - ($this->outstandingCents() - (int) $latest->loans_out_cents);
    }

    public function lend(User $member, User $admin, int $amountCents, ?string $note = null): CashLoan
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }
        if ($member->isGuest() || ! in_array($member->role, [User::ROLE_ADMIN, User::ROLE_MEMBER], true)) {
            throw new RuntimeException('Il prestito dalla cassa si può dare solo ai soci.');
        }

        return DB::transaction(function () use ($member, $admin, $amountCents, $note) {
            // Con almeno un conteggio del cassetto, non si può prestare più dei contanti attesi.
            $inDrawer = $this->drawerEstimateCents();
            if ($inDrawer !== null && $amountCents > $inDrawer) {
                throw new RuntimeException('Nel cassetto dovrebbero esserci solo '.number_format(max(0, $inDrawer) / 100, 2, ',', '.').' € (da ultimo conteggio): non si può prestare di più.');
            }

            $loan = CashLoan::create([
                'user_id' => $member->id,
                'created_by' => $admin->id,
                'amount_cents' => $amountCents,
                'status' => 'open',
                'note' => $note,
                'borrowed_at' => now(),
            ]);

            $this->cashService->createFromCents([
                'amount_cents' => $amountCents,
                'direction' => 'uscita',
                'type' => self::LEND_TYPE,
                'category' => 'prestiti',
                'description' => "Prestito dalla cassa a {$member->name}",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'member_id' => $member->id,
                'cash_loan_id' => $loan->id,
                'note' => $note,
                // Traccia nello storico, ma il saldo dell'app resta com'è.
                'affects_current_balance' => false,
            ], $admin);

            $this->audit($admin, $member, 'cash_loan_created', $loan, ['amount_cents' => $amountCents, 'note' => $note]);

            return $loan->fresh();
        });
    }

    /** Restituzione (anche parziale): i soldi rientrano nel cassetto. */
    public function repay(CashLoan $loan, User $admin, int $amountCents, ?string $note = null): CashLoan
    {
        return DB::transaction(function () use ($loan, $admin, $amountCents, $note) {
            $locked = CashLoan::query()->whereKey($loan->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'open') {
                throw new RuntimeException('Questo prestito è già chiuso.');
            }
            if ($amountCents <= 0 || $amountCents > $locked->remaining_cents) {
                throw new RuntimeException('Puoi registrare da 0,01 € fino a '.number_format($locked->remaining_cents / 100, 2, ',', '.').' €.');
            }

            $member = User::query()->findOrFail($locked->user_id);
            $this->cashService->createFromCents([
                'amount_cents' => $amountCents,
                'direction' => 'entrata',
                'type' => self::REPAY_TYPE,
                'category' => 'prestiti',
                'description' => "Restituzione prestito di {$member->name}",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'member_id' => $member->id,
                'cash_loan_id' => $locked->id,
                'note' => $note,
                'affects_current_balance' => false,
            ], $admin);

            $locked->repaid_cents += $amountCents;
            if ($locked->repaid_cents >= $locked->amount_cents) {
                $locked->status = 'repaid';
                $locked->repaid_at = now();
            }
            $locked->save();

            $this->audit($admin, $member, 'cash_loan_repaid', $locked, ['amount_cents' => $amountCents, 'closed' => $locked->status === 'repaid']);

            return $locked->fresh();
        });
    }

    /** Prestito registrato per sbaglio: i soldi tornano nel cassetto. Solo se non c'è stata nessuna restituzione. */
    public function cancel(CashLoan $loan, User $admin, string $reason): CashLoan
    {
        return DB::transaction(function () use ($loan, $admin, $reason) {
            $locked = CashLoan::query()->whereKey($loan->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'open') {
                throw new RuntimeException('Questo prestito è già chiuso.');
            }
            if ($locked->repaid_cents > 0) {
                throw new RuntimeException('Una parte è già stata restituita: registra il resto come restituzione invece di annullare.');
            }

            $lend = CashMovement::query()->where('cash_loan_id', $locked->id)->where('type', self::LEND_TYPE)->where('status', 'active')->firstOrFail();
            $reversal = $this->cashService->reverse($lend, $admin);
            $reversal->update(['note' => $reason, 'description' => 'Annullamento: '.$lend->description, 'cash_loan_id' => $locked->id]);

            $locked->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancel_reason' => $reason]);

            $this->audit($admin, User::query()->findOrFail($locked->user_id), 'cash_loan_cancelled', $locked, ['reason' => $reason]);

            return $locked->fresh();
        });
    }

    private function audit(User $admin, User $member, string $action, CashLoan $loan, array $extra): void
    {
        AdminAuditLog::create([
            'admin_id' => $admin->id,
            'target_user_id' => $member->id,
            'action' => $action,
            'changes' => ['cash_loan_id' => $loan->id, ...$extra],
        ]);
    }
}
