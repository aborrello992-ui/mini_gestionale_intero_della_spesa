<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['restock_session_id', 'product_id', 'shopping_list_item_id', 'package_count', 'pieces_per_package', 'quantity', 'selling_price_cents', 'cost_cents', 'unit_cost_cents', 'previous_average_cost_cents', 'new_average_cost_cents'])]
class RestockSessionItem extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function shoppingListItem(): BelongsTo
    {
        return $this->belongsTo(ShoppingListItem::class);
    }
}
