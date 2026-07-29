<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['restoration_key', 'withdrawal_id', 'user_id', 'original_amount_cents', 'paid_amount_cents', 'remaining_amount_cents', 'type', 'description', 'status', 'notes'])]
class MemberDebt extends Model
{
    use HasFactory;

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function withdrawal(): BelongsTo
    {
        return $this->belongsTo(Withdrawal::class);
    }
}
