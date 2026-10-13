<?php

namespace App\Services;

use App\Models\CashCount;
use App\Models\User;
use RuntimeException;

/**
 * Contanti reali nel cassetto. Il saldo dell'app puo differire dai contanti per motivi noti
 * (es. una spesa pagata di tasca da un socio): per questo si confrontano le VARIAZIONI.
 * Contanti attesi = ultimo conteggio + (saldo dell'app adesso - saldo dell'app al conteggio).
 */
class CashCountService
{
    public function __construct(private CashService $cashService) {}

    /** @param  array<int|string, int|string>|null  $breakdown  taglio in centesimi => numero di pezzi */
    public function record(User $admin, ?int $countedCents, ?array $breakdown, ?string $note): CashCount
    {
        if ($breakdown) {
            $clean = [];
            foreach ($breakdown as $denomination => $pieces) {
                $denomination = (int) $denomination;
                $pieces = (int) $pieces;
                if (! in_array($denomination, CashCount::DENOMINATIONS, true) || $pieces < 0) {
                    throw new RuntimeException('Taglio o numero di pezzi non valido.');
                }
                if ($pieces > 0) {
                    $clean[$denomination] = $pieces;
                }
            }
            $breakdown = $clean;
            $countedCents = array_sum(array_map(fn ($denomination, $pieces) => $denomination * $pieces, array_keys($clean), $clean));
        }

        if ($countedCents === null || $countedCents < 0) {
            throw new RuntimeException('Indica quanti contanti ci sono nel cassetto.');
        }

        return CashCount::create([
            'user_id' => $admin->id,
            'counted_cents' => $countedCents,
            'app_balance_cents' => $this->cashService->balanceCents(),
            'breakdown' => $breakdown ?: null,
            'note' => $note,
            'counted_at' => now(),
        ])->load('user:id,name');
    }

    /** Situazione attuale e storico: per ogni conteggio quanto mancava o avanzava rispetto al precedente. */
    public function overview(int $limit = 20): array
    {
        $balance = $this->cashService->balanceCents();
        $counts = CashCount::query()->with('user:id,name')->latest('counted_at')->latest('id')->limit($limit + 1)->get()->values();

        $rows = $counts->take($limit)->map(function (CashCount $count, int $index) use ($counts) {
            $previous = $counts->get($index + 1);
            $expected = $previous ? $previous->counted_cents + ($count->app_balance_cents - $previous->app_balance_cents) : null;

            return [
                ...$count->only(['id', 'counted_cents', 'app_balance_cents', 'breakdown', 'note', 'counted_at']),
                'user' => $count->user?->only(['id', 'name']),
                'expected_cents' => $expected,
                // Negativo = mancano soldi rispetto al conteggio precedente, positivo = avanzano.
                'drift_cents' => $expected === null ? null : $count->counted_cents - $expected,
            ];
        })->values();

        $latest = $counts->first();

        return [
            'balance_cents' => $balance,
            'latest' => $rows->first(),
            'expected_cents' => $latest ? $latest->counted_cents + ($balance - $latest->app_balance_cents) : null,
            'counts' => $rows,
            'denominations' => CashCount::DENOMINATIONS,
        ];
    }
}
