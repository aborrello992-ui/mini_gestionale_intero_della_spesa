<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReset;
use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\RestockSession;
use App\Models\Withdrawal;
use Illuminate\Http\Request;

/**
 * Archivio conti precedenti all'azzeramento: sola lettura.
 */
class ArchiveController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['type' => ['nullable', 'in:cash,debts,withdrawals,receipts']]);
        $perPage = min(max($request->integer('per_page', 50), 1), 200);

        $query = match ($data['type'] ?? 'cash') {
            'debts' => MemberDebt::onlyArchived()->with('member:id,name')->latest('created_at'),
            'withdrawals' => Withdrawal::onlyArchived()->with('member:id,name', 'product:id,name,unit')->latest('withdrawn_at'),
            'receipts' => RestockSession::onlyArchived()->with('user:id,name')->latest('purchased_at'),
            default => CashMovement::onlyArchived()->with('user:id,name', 'member:id,name')->latest('movement_date')->latest('id'),
        };

        return [
            'resets' => AccountReset::query()->orderByDesc('cutoff_date')->get(['id', 'cutoff_date', 'cutoff_at', 'opening_cash_cents', 'created_at']),
            'records' => $query->paginate($perPage),
        ];
    }
}
