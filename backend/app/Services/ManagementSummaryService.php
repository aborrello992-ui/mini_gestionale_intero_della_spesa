<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\RestockSessionItem;
use App\Models\User;

/**
 * Contatori della sezione Gestione, calcolati sul server.
 * I record archiviati dall'azzeramento conti sono esclusi dagli scope globali dei modelli.
 */
class ManagementSummaryService
{
    /** Tipi di movimento mostrati nel riepilogo, con etichetta. */
    public const CASH_TYPES = [
        'accredito' => 'Accrediti',
        'quota' => 'Quote',
        'rimborso' => 'Rimborsi',
        'spesa_generica' => 'Spese generiche',
        'prodotto_pagato' => 'Pagamenti prodotti',
        'pagamento_debito' => 'Saldo copponi',
        'acquisto_prodotti' => 'Spese da scontrino',
    ];

    public function __construct(private CashService $cashService, private DebtService $debtService) {}

    public function summary(?string $from, ?string $to): array
    {
        return [
            'period' => ['from' => $from, 'to' => $to],
            'balance_cents' => $this->cashService->balanceCents(),
            'cash' => $this->cashByType($from, $to),
            'members' => $this->members(),
            'open_coppone_cents' => (int) MemberDebt::query()->where('status', 'open')->sum('remaining_amount_cents'),
            'inventory' => $this->inventory(),
            'receipts' => $this->receipts($from, $to),
        ];
    }

    private function cashByType(?string $from, ?string $to): array
    {
        // Solo movimenti attivi che toccano la cassa: un movimento annullato e il suo storno si escludono a vicenda.
        $rows = CashMovement::query()
            ->where('status', 'active')
            ->where('type', '!=', 'annullamento')
            ->where('affects_current_balance', true)
            ->when($from, fn ($q) => $q->whereDate('movement_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('movement_date', '<=', $to))
            ->selectRaw('type, direction, SUM(amount_cents) as total, COUNT(*) as movements')
            ->groupBy('type', 'direction')
            ->get();

        $byType = [];
        foreach ($rows as $row) {
            $key = array_key_exists($row->type, self::CASH_TYPES) ? $row->type : 'altro';
            $byType[$key] ??= ['type' => $key, 'label' => self::CASH_TYPES[$key] ?? 'Altri movimenti', 'income_cents' => 0, 'outcome_cents' => 0, 'movements' => 0];
            $byType[$key][$row->direction === 'entrata' ? 'income_cents' : 'outcome_cents'] += (int) $row->total;
            $byType[$key]['movements'] += (int) $row->movements;
        }

        return [
            'income_cents' => array_sum(array_column($byType, 'income_cents')),
            'outcome_cents' => array_sum(array_column($byType, 'outcome_cents')),
            'by_type' => array_values($byType),
        ];
    }

    private function members(): array
    {
        $openDebts = MemberDebt::query()
            ->where('status', 'open')
            ->selectRaw('user_id, SUM(remaining_amount_cents) as total')
            ->groupBy('user_id')
            ->pluck('total', 'user_id');

        return User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'open_coppone_cents' => (int) ($openDebts[$member->id] ?? 0),
                'wallet_credit_cents' => $this->debtService->walletCreditCents($member),
            ])
            ->all();
    }

    private function inventory(): array
    {
        $value = Product::query()->active()
            ->where('current_quantity', '>', 0)
            ->selectRaw('COALESCE(SUM(current_quantity * average_price_cents), 0) as at_cost, COALESCE(SUM(current_quantity * selling_price_cents), 0) as at_price')
            ->toBase()
            ->first();

        return [
            'value_at_cost_cents' => (int) round((float) $value->at_cost),
            'value_at_price_cents' => (int) round((float) $value->at_price),
        ];
    }

    private function receipts(?string $from, ?string $to): array
    {
        $sessions = RestockSession::query()
            ->when($from, fn ($q) => $q->whereDate('purchased_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('purchased_at', '<=', $to));
        $sessionIds = (clone $sessions)->pluck('id');
        $items = RestockSessionItem::query()->whereIn('restock_session_id', $sessionIds);

        $expenses = (clone $items)->where('item_type', 'expense')
            ->selectRaw('expense_category, SUM(cost_cents) as total')
            ->groupBy('expense_category')
            ->pluck('total', 'expense_category')
            ->map(fn ($total) => (int) $total);

        return [
            'count' => $sessionIds->count(),
            'lines' => (clone $items)->count(),
            'total_cents' => (int) (clone $sessions)->sum('total_cents'),
            'products_cents' => (int) (clone $items)->where('item_type', 'product')->sum('cost_cents'),
            'expenses_cents' => (int) $expenses->sum(),
            'expenses_by_category' => $expenses,
            'difference_cents' => (int) (clone $sessions)->sum('difference_cents'),
        ];
    }
}
