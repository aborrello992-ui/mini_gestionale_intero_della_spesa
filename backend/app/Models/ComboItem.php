<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['combo_id', 'product_id', 'quantity', 'choice_group'])]
class ComboItem extends Model
{
    protected function casts(): array
    {
        return ['quantity' => 'decimal:3', 'choice_group' => 'integer'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
