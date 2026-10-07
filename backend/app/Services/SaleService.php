<?php

namespace App\Services;

use App\Models\Combo;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Vendita di uno o piu prodotti e/o combo, pagata da uno o piu soci ("mangia con un amico").
 * Ogni socio riceve un prelievo per ogni prodotto con la sua quota di quantita e di prezzo:
 * cassa, debiti, storico e riassegnazioni continuano a funzionare come per i prelievi normali.
 */
class SaleService
{
    public const MAX_PARTICIPANTS = 6;

    public function __construct(private WithdrawalService $withdrawalService) {}

    /**
     * @param  array<int, array{product_id?: int, combo_id?: int, quantity: float|int|string}>  $lines
     * @param  array<int, array{member: User, payment_status: string}>  $participants
     */
    public function checkout(array $lines, array $participants, User $actor, ?string $note = null): array
    {
        if ($participants === [] || count($participants) > self::MAX_PARTICIPANTS) {
            throw new RuntimeException('Da 1 a '.self::MAX_PARTICIPANTS.' persone per ogni acquisto.');
        }

        return DB::transaction(function () use ($lines, $participants, $actor, $note) {
            $components = $this->components($lines);
            $total = array_sum(array_column($components, 'cents'));
            $count = count($participants);
            $kind = $count > 1 ? 'shared' : (collect($components)->contains(fn ($c) => $c['combo_id']) ? 'combo' : 'single');

            $sale = Sale::create([
                'created_by' => $actor->id,
                'kind' => $kind,
                'total_cents' => $total,
                'participants_count' => $count,
                'note' => $note,
            ]);

            $shares = array_fill(0, $count, 0);
            $offset = 0;
            foreach ($components as $component) {
                $cents = $this->splitCents($component['cents'], $count, $offset);
                $quantities = $this->splitQuantity($component['quantity'], $count);
                $offset += $component['cents'] % $count;
                foreach ($quantities as $index => $share) {
                    if ($share <= 0 && $cents[$index] > 0) {
                        $cents[$count - 1] += $cents[$index];
                        $cents[$index] = 0;
                    }
                }

                foreach ($participants as $index => $participant) {
                    if ($quantities[$index] <= 0) {
                        continue;
                    }
                    $this->withdrawalService->take(
                        $component['product'],
                        $participant['member'],
                        $actor,
                        $quantities[$index],
                        $participant['payment_status'],
                        $this->noteFor($component, $count, $note),
                        ['total_cents' => $cents[$index], 'sale_id' => $sale->id, 'combo_id' => $component['combo_id']],
                    );
                    $shares[$index] += $cents[$index];
                }
            }

            return [
                'sale' => $sale->fresh(),
                'total_cents' => $total,
                'shares' => collect($participants)->map(fn ($participant, $index) => [
                    'member_id' => $participant['member']->id,
                    'name' => $participant['member']->name,
                    'payment_status' => $participant['payment_status'],
                    'total_cents' => $shares[$index],
                ])->values()->all(),
            ];
        });
    }

    /** Trasforma righe prodotto/combo in componenti prodotto con quantita e importo in centesimi. */
    private function components(array $lines): array
    {
        $components = [];
        foreach ($lines as $line) {
            $quantity = (float) $line['quantity'];
            if ($quantity <= 0) {
                throw new RuntimeException('La quantità deve essere maggiore di zero.');
            }

            if (! empty($line['combo_id'])) {
                $combo = Combo::query()->with('items.product')->whereKey($line['combo_id'])->first();
                if (! $combo || ! $combo->is_active) {
                    throw new RuntimeException('Questa combo non è più disponibile.');
                }
                if (floor($quantity) != $quantity) {
                    throw new RuntimeException('Le combo si prendono intere.');
                }
                $components = [...$components, ...$this->comboComponents($combo, (int) $quantity)];

                continue;
            }

            $product = Product::query()->active()->whereKey($line['product_id'] ?? 0)->first();
            if (! $product) {
                throw new RuntimeException('Prodotto non disponibile.');
            }
            $components[] = [
                'product' => $product,
                'quantity' => $quantity,
                'cents' => (int) round($quantity * (int) ($product->selling_price_cents ?: $product->average_price_cents)),
                'combo_id' => null,
                'label' => $product->name,
            ];
        }

        return $components;
    }

    /** Ripartisce il prezzo della combo sui prodotti in proporzione al loro prezzo normale. */
    private function comboComponents(Combo $combo, int $times): array
    {
        $items = $combo->items->filter(fn ($item) => $item->product)->values();
        if ($items->isEmpty()) {
            throw new RuntimeException("La combo «{$combo->name}» non contiene prodotti.");
        }

        $weights = $items->map(fn ($item) => max(0, (float) $item->quantity * (int) $item->product->selling_price_cents))->all();
        $weightTotal = array_sum($weights);
        if ($weightTotal <= 0) {
            $weights = $items->map(fn ($item) => (float) $item->quantity)->all();
            $weightTotal = array_sum($weights);
        }

        $price = (int) $combo->price_cents * $times;
        $allocated = 0;
        $components = [];
        foreach ($items as $index => $item) {
            $isLast = $index === $items->count() - 1;
            $cents = $isLast ? $price - $allocated : (int) floor($price * $weights[$index] / $weightTotal);
            $allocated += $cents;
            $components[] = [
                'product' => $item->product,
                'quantity' => (float) $item->quantity * $times,
                'cents' => $cents,
                'combo_id' => $combo->id,
                'label' => $combo->name,
            ];
        }

        return $components;
    }

    /** Divide i centesimi in parti uguali; i centesimi avanzati ruotano fra i partecipanti. */
    private function splitCents(int $cents, int $count, int $offset): array
    {
        $base = intdiv($cents, $count);
        $remainder = $cents % $count;
        $parts = array_fill(0, $count, $base);
        for ($i = 0; $i < $remainder; $i++) {
            $parts[($offset + $i) % $count]++;
        }

        return $parts;
    }

    /** Divide la quantita (3 decimali); l'ultimo prende il resto cosi il magazzino scala il totale esatto. */
    private function splitQuantity(float $quantity, int $count): array
    {
        $share = floor(($quantity / $count) * 1000) / 1000;
        $parts = array_fill(0, $count, $share);
        $parts[$count - 1] = round($quantity - $share * ($count - 1), 3);

        return $parts;
    }

    private function noteFor(array $component, int $count, ?string $note): string
    {
        $parts = [];
        if ($component['combo_id']) {
            $parts[] = "Combo {$component['label']}";
        }
        if ($count > 1) {
            $parts[] = "Diviso fra {$count}";
        }
        if ($note) {
            $parts[] = $note;
        }

        return implode(' · ', $parts);
    }
}
