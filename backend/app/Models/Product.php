<?php

namespace App\Models;

use App\Support\NameNormalizer;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'category_id', 'location_id', 'name', 'normalized_name', 'description', 'unit',
    'current_quantity', 'minimum_threshold', 'average_price_cents',
    'last_purchase_price_cents', 'is_active', 'archived_at',
])]
class Product extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'current_quantity' => 'decimal:3',
            'minimum_threshold' => 'decimal:3',
            'archived_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public static function booted(): void
    {
        static::saving(function (Product $product): void {
            $product->normalized_name = NameNormalizer::normalize($product->name);
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->whereNull('archived_at');
    }
}
