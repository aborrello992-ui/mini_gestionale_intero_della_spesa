<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'purchase_id', 'reverses_movement_id', 'amount_cents', 'direction',
    'type', 'category', 'description', 'movement_date', 'note', 'status',
])]
class CashMovement extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['movement_date' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
