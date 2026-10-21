<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

#[Fillable(['name', 'description', 'price_cents', 'is_active'])]
class Combo extends Model
{
    protected $appends = ['list_price_cents', 'available_count'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'price_cents' => 'integer'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ComboItem::class);
    }

    /**
     * Posti della combo: un prodotto fisso, oppure un gruppo di alternative (stessa choice_group)
     * di cui ne viene scelta una sola all'acquisto.
     */
    public function slots(): Collection
    {
        return $this->items->groupBy(fn (ComboItem $item) => $item->choice_group ? 'g'.$item->choice_group : 'i'.$item->id);
    }

    /** Prezzo dei prodotti comprati separatamente (per un posto a scelta conta la prima alternativa). */
    public function getListPriceCentsAttribute(): int
    {
        return (int) $this->slots()->sum(function (Collection $slot) {
            $item = $slot->first();

            return round((float) $item->quantity * (int) ($item->product?->selling_price_cents ?? 0));
        });
    }

    /** Quante combo si possono ancora vendere con il magazzino attuale. */
    public function getAvailableCountAttribute(): int
    {
        if ($this->items->isEmpty()) {
            return 0;
        }

        return (int) $this->slots()->min(function (Collection $slot) {
            // Posto a scelta: valgono le scorte di tutte le alternative sommate.
            return (int) $slot->sum(function (ComboItem $item) {
                $product = $item->product;
                if (! $product || ! $product->is_active || $product->archived_at || (float) $item->quantity <= 0) {
                    return 0;
                }

                return (int) floor(((float) $product->current_quantity + 1e-9) / (float) $item->quantity);
            });
        });
    }
}
