<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['archived_at', 'archived_reason', 
    'product_id', 'user_id', 'purchase_id', 'withdrawal_id', 'cash_movement_id', 'reverses_movement_id', 'type',
    'quantity', 'previous_quantity', 'resulting_quantity', 'note', 'status',
    'unit_price_cents', 'total_amount_cents',
])]
class InventoryMovement extends Model
{
    use Archivable, HasFactory;

    /** Tipi che rappresentano un prelievo (vecchio flusso e prelievi con PIN). */
    public const WITHDRAWAL_TYPES = ['prelievo', 'prelievo_pagato', 'prelievo_coppone', 'prelievo_ospite'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'previous_quantity' => 'decimal:3',
            'resulting_quantity' => 'decimal:3',
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

    public function withdrawal(): BelongsTo
    {
        return $this->belongsTo(Withdrawal::class);
    }
}
