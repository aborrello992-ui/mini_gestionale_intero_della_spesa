<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['archived_at', 'archived_reason', 
    'user_id', 'product_id', 'created_by', 'quantity', 'unit_price_cents',
    'total_amount_cents', 'payment_status', 'withdrawn_at', 'status', 'notes',
    'original_user_id', 'reassigned_at', 'reassigned_by', 'reassign_reason', 'is_manual', 'affects_stock', 'sale_id', 'combo_id', 'sponsor_id', 'payment_verified_at', 'payment_verified_by',
    'cancelled_at', 'cancelled_by', 'cancel_reason', 'payment_corrected_at', 'payment_corrected_by', 'payment_correction_reason',
])]
class Withdrawal extends Model
{
    use Archivable, HasFactory;

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'withdrawn_at' => 'datetime',
            'reassigned_at' => 'datetime',
            'payment_verified_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'payment_corrected_at' => 'datetime',
            'is_manual' => 'boolean',
            'affects_stock' => 'boolean',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Pagamento di un ospite in attesa di verifica da parte di un admin. */
    public const PAYMENT_PENDING = 'pending';

    public function sponsor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sponsor_id');
    }

    public function combo(): BelongsTo
    {
        return $this->belongsTo(Combo::class);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(MemberDebt::class);
    }

    public function originalMember(): BelongsTo
    {
        return $this->belongsTo(User::class, 'original_user_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
