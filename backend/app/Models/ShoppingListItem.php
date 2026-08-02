<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'user_id', 'suggested_quantity', 'purchased_quantity', 'estimated_price_cents', 'priority', 'note', 'status', 'completed_at', 'restock_session_id'])]
class ShoppingListItem extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'suggested_quantity' => 'decimal:3',
            'completed_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
