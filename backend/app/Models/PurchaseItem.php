<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['purchase_id', 'product_id', 'quantity', 'unit_cost_cents', 'line_total_cents'])]
class PurchaseItem extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }
}
