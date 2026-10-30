<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'created_by', 'amount_cents', 'repaid_cents', 'status', 'note', 'borrowed_at', 'repaid_at', 'cancelled_at', 'cancel_reason'])]
class CashLoan extends Model
{
    protected $appends = ['remaining_cents'];

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'repaid_cents' => 'integer',
            'borrowed_at' => 'datetime',
            'repaid_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getRemainingCentsAttribute(): int
    {
        return max(0, (int) $this->amount_cents - (int) $this->repaid_cents);
    }
}
