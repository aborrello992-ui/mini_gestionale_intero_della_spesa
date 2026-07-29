<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'member_id', 'product_id', 'purchase_id', 'withdrawal_id', 'debt_payment_id',
    'reverses_movement_id', 'amount_cents', 'resulting_balance_cents', 'direction',
    'type', 'category', 'description', 'movement_date', 'movement_time', 'note', 'status',
    'affects_current_balance', 'is_opening_historical_record',
])]
class CashMovement extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'movement_date' => 'date',
            'affects_current_balance' => 'boolean',
            'is_opening_historical_record' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
