<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['restock_session_id', 'product_id', 'shopping_list_item_id', 'quantity', 'selling_price_cents', 'cost_cents'])]
class RestockSessionItem extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }
}
