<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemberDebt;
use App\Models\User;
use App\Services\CashService;
use App\Services\DebtService;
use Illuminate\Http\Request;
use RuntimeException;

class DebtController extends Controller
{
    public function index()
    {
        return User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->withSum(['memberDebts as open_debt_cents' => fn ($q) => $q->where('status', 'open')], 'remaining_amount_cents')
            ->withCount(['memberDebts as open_debts_count' => fn ($q) => $q->where('status', 'open')])
            ->withMax(['memberDebts as last_debt_at' => fn ($q) => $q->where('status', 'open')], 'created_at')
            ->withSum(['personalCashMovements as wallet_credit_cents' => fn ($q) => $q
                ->where('status', 'active')
                ->where('type', 'accredito')
                ->where('direction', 'entrata')
                ->where('affects_current_balance', true)
            ], 'amount_cents')
            ->orderByDesc('open_debt_cents')
            ->orderByDesc('wallet_credit_cents')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_path']);
    }

    public function show(User $member)
    {
        $debts = MemberDebt::with('withdrawal.product')
            ->where('user_id', $member->id)
            ->where('status', 'open')
            ->latest()
            ->get();

        return [
            'member' => [
                ...$member->only(['id', 'name', 'avatar_path']),
                'wallet_credit_cents' => (int) $member->personalCashMovements()
                    ->where('status', 'active')
                    ->where('type', 'accredito')
                    ->where('direction', 'entrata')
                    ->where('affects_current_balance', true)
                    ->sum('amount_cents'),
            ],
            'items' => $debts,
            'total_due_cents' => (int) $debts->sum('original_amount_cents'),
            'total_paid_cents' => (int) $debts->sum('paid_amount_cents'),
            'remaining_cents' => (int) $debts->sum('remaining_amount_cents'),
        ];
    }

    public function pay(User $member, Request $request, DebtService $service, CashService $cashService)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            return response()->json($service->pay($member, $request->user(), $cashService->toCents($data['amount']), $data['note'] ?? null), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
