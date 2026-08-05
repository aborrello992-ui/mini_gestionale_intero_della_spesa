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
    public function index(DebtService $service)
    {
        return User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->withSum(['memberDebts as open_debt_cents' => fn ($q) => $q->where('status', 'open')], 'remaining_amount_cents')
            ->withCount(['memberDebts as open_debts_count' => fn ($q) => $q->where('status', 'open')])
            ->withMax(['memberDebts as last_debt_at' => fn ($q) => $q->where('status', 'open')], 'created_at')
            ->orderByDesc('open_debt_cents')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_path'])
            ->map(function (User $member) use ($service) {
                $member->wallet_credit_cents = $service->walletCreditCents($member);

                return $member;
            });
    }

    public function show(User $member, DebtService $service)
    {
        $debts = MemberDebt::with('withdrawal.product')
            ->where('user_id', $member->id)
            ->where('status', 'open')
            ->latest()
            ->get();

        return [
            'member' => [
                ...$member->only(['id', 'name', 'avatar_path']),
                'wallet_credit_cents' => $service->walletCreditCents($member),
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
