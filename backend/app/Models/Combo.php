<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    /** Prezzo dei prodotti comprati separatamente. */
    public function getListPriceCentsAttribute(): int
    {
        return (int) $this->items->sum(fn (ComboItem $item) => round((float) $item->quantity * (int) ($item->product?->selling_price_cents ?? 0)));
    }

    /** Quante combo si possono ancora vendere con il magazzino attuale. */
    public function getAvailableCountAttribute(): int
    {
        if ($this->items->isEmpty()) {
            return 0;
        }

        return (int) $this->items->min(function (ComboItem $item) {
            $product = $item->product;
            if (! $product || ! $product->is_active || $product->archived_at || (float) $item->quantity <= 0) {
                return 0;
            }

            return (int) floor(((float) $product->current_quantity + 1e-9) / (float) $item->quantity);
        });
    }
}
