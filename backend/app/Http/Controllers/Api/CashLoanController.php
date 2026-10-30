<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashLoan;
use App\Models\User;
use App\Services\CashLoanService;
use App\Services\CashService;
use Illuminate\Http\Request;
use RuntimeException;

class CashLoanController extends Controller
{
    /** Prestiti da restituire di chi è entrato: serve al promemoria all'accesso. */
    public function mine(Request $request)
    {
        return CashLoan::query()
            ->where('user_id', $request->user()->id)->where('status', 'open')
            ->orderBy('borrowed_at')
            ->get(['id', 'amount_cents', 'repaid_cents', 'note', 'borrowed_at']);
    }

    /** Prestiti aperti di tutti (admin). */
    public function index()
    {
        return CashLoan::query()
            ->with('member:id,name,avatar_path')
            ->where('status', 'open')
            ->orderBy('borrowed_at')
            ->get();
    }

    public function store(Request $request, CashLoanService $service, CashService $cashService)
    {
        $data = $request->validate([
            'member_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:10000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            return response()->json($service->lend(User::query()->findOrFail($data['member_id']), $request->user(), $cashService->toCents($data['amount']), $data['note'] ?? null)->load('member:id,name'), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function repay(CashLoan $loan, Request $request, CashLoanService $service, CashService $cashService)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            return $service->repay($loan, $request->user(), $cashService->toCents($data['amount']), $data['note'] ?? null)->load('member:id,name');
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function cancel(CashLoan $loan, Request $request, CashLoanService $service)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']], ['reason.required' => 'Indica il motivo dell\'annullamento.']);

        try {
            return $service->cancel($loan, $request->user(), $data['reason'])->load('member:id,name');
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
