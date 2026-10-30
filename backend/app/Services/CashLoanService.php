<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\CashLoan;
use App\Models\CashMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Soldi presi in prestito dalla cassa da un socio: escono subito dalla cassa e il socio
 * riceve un promemoria finché non li restituisce. Non c'entrano con i copponi dei prodotti.
 */
class CashLoanService
{
    public const LEND_TYPE = 'prestito_cassa';

    public const REPAY_TYPE = 'restituzione_prestito';

    public function __construct(private CashService $cashService) {}

    public function lend(User $member, User $admin, int $amountCents, ?string $note = null): CashLoan
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }
        if ($member->isGuest() || ! in_array($member->role, [User::ROLE_ADMIN, User::ROLE_MEMBER], true)) {
            throw new RuntimeException('Il prestito dalla cassa si può dare solo ai soci.');
        }

        return DB::transaction(function () use ($member, $admin, $amountCents, $note) {
            $balance = $this->cashService->balanceCents();
            if ($amountCents > $balance) {
                throw new RuntimeException('In cassa ci sono solo '.number_format($balance / 100, 2, ',', '.').' €: non si può prestare di più.');
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
            ], $admin);

            $this->audit($admin, $member, 'cash_loan_created', $loan, ['amount_cents' => $amountCents, 'note' => $note]);

            return $loan->fresh();
        });
    }

    /** Restituzione (anche parziale): i soldi rientrano in cassa. */
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

    /** Prestito registrato per sbaglio: i soldi tornano in cassa. Solo se non c'è stata nessuna restituzione. */
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
