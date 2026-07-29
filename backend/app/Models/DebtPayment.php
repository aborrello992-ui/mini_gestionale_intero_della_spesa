<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'admin_user_id', 'amount_cents', 'paid_at', 'type', 'note'])]
class DebtPayment extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['paid_at' => 'datetime'];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
