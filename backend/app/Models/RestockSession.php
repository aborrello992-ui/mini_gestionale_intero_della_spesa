<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable(['archived_at', 'archived_reason', 'user_id', 'idempotency_key', 'total_cents', 'difference_cents', 'difference_reason', 'purchased_at', 'purchased_time', 'receipt_image_path', 'status', 'note'])]
class RestockSession extends Model
{
    use Archivable, HasFactory;

    protected $appends = ['receipt_image_url'];

    protected function casts(): array
    {
        return ['purchased_at' => 'date'];
    }

    /** Indirizzo pubblico della foto dello scontrino (Supabase o disco locale). */
    public function getReceiptImageUrlAttribute(): ?string
    {
        return $this->receipt_image_path ? Storage::disk('public')->url($this->receipt_image_path) : null;
    }

    public function items(): HasMany
    {
        return $this->hasMany(RestockSessionItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
