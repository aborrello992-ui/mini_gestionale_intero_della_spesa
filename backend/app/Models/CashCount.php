<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'counted_cents', 'app_balance_cents', 'breakdown', 'note', 'counted_at'])]
class CashCount extends Model
{
    /** Tagli accettati nel conteggio, in centesimi. */
    public const DENOMINATIONS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

    protected function casts(): array
    {
        return [
            'breakdown' => 'array',
            'counted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
