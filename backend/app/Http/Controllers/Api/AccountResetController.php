<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReset;
use App\Models\AdminAuditLog;
use App\Services\AccountResetService;
use App\Support\RestockLine;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Azzeramento conti dall'app (solo admin): anteprima, esecuzione con conferma scritta, annullamento.
 * Nulla viene cancellato: i record precedenti al taglio vengono archiviati.
 */
class AccountResetController extends Controller
{
    public function preview(Request $request, AccountResetService $service)
    {
        $data = $this->validated($request);

        return [
            ...$service->preview($data['cutoff'], $data['opening_cents']),
            'already_done' => $this->existing($service, $data['cutoff']) !== null,
        ];
    }

    public function store(Request $request, AccountResetService $service)
    {
        $data = $this->validated($request, ['confirm_text' => ['required', 'in:AZZERA']]);

        if (isset($data['expected_open_debts']) && $data['expected_open_debts'] !== null) {
            $expected = RestockLine::toCents($data['expected_open_debts']);
            $after = (int) collect($service->preview($data['cutoff'], $data['opening_cents'])['members'])->sum('open_debt_after');
            if ($expected !== $after) {
                throw ValidationException::withMessages(['expected_open_debts' => 'Dopo l\'azzeramento i debiti sarebbero '.number_format($after / 100, 2, ',', '.').' €, non '.number_format($expected / 100, 2, ',', '.').' €. Nessuna modifica.']);
            }
        }

        try {
            $reset = $service->execute($data['cutoff'], $data['opening_cents'], $request->user(), null);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        AdminAuditLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'account_reset',
            'changes' => ['cutoff' => $service->label($data['cutoff']), 'opening_cash_cents' => $data['opening_cents']],
        ]);

        return response()->json($reset, 201);
    }

    public function undo(Request $request, AccountResetService $service)
    {
        $data = $request->validate([
            'cutoff' => ['required', 'regex:/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/'],
            'confirm_text' => ['required', 'in:ANNULLA'],
        ], ['confirm_text.in' => 'Scrivi ANNULLA per confermare.']);

        try {
            $service->undo($data['cutoff']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        AdminAuditLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'account_reset_undone',
            'changes' => ['cutoff' => $data['cutoff']],
        ]);

        return response()->noContent();
    }

    private function validated(Request $request, array $extra = []): array
    {
        if (is_string($request->input('opening_cash'))) {
            $request->merge(['opening_cash' => str_replace(',', '.', $request->input('opening_cash'))]);
        }

        $data = $request->validate([
            'cutoff' => ['required', 'regex:/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/'],
            'opening_cash' => ['required', 'numeric'],
            'expected_open_debts' => ['nullable', 'string', 'max:20'],
            ...$extra,
        ], [
            'cutoff.regex' => 'Indica data e ora del taglio.',
            'opening_cash.required' => 'Indica il saldo di cassa da cui ripartire (anche 0).',
            'confirm_text.in' => 'Scrivi AZZERA per confermare.',
            'confirm_text.required' => 'Scrivi AZZERA per confermare.',
        ]);
        $data['opening_cents'] = RestockLine::toCents((string) $data['opening_cash']);

        return $data;
    }

    private function existing(AccountResetService $service, string $cutoff): ?AccountReset
    {
        return AccountReset::query()
            ->whereDate('cutoff_date', $service->moment($cutoff)->setTimezone(AccountReset::LOCAL_TIMEZONE)->toDateString())
            ->first();
    }
}
