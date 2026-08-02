<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'total_cents', 'difference_cents', 'difference_reason', 'purchased_at', 'purchased_time', 'receipt_image_path', 'status', 'note'])]
class RestockSession extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['purchased_at' => 'date'];
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
