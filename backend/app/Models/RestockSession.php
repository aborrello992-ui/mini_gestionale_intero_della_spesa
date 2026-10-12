<?php

namespace App\Models;

use App\Support\MediaUrl;
use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        return MediaUrl::for($this->receipt_image_path);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RestockSessionItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scontrini da considerare annullati: segnati come tali, oppure con l'uscita di cassa annullata
     * (es. spesa registrata per sbaglio, annullata dalla pagina Cassa lasciando la merce in magazzino).
     *
     * @param  iterable<int>  $ids
     * @return array<int, int>
     */
    public static function cancelledIds(iterable $ids): array
    {
        $ids = collect($ids)->map(fn ($id) => (int) $id)->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $byStatus = static::withArchived()->whereIn('id', $ids)->where('status', 'cancelled')->pluck('id');
        $byCash = CashMovement::withArchived()
            ->where('status', 'reversed')
            ->where('type', 'acquisto_prodotti')
            ->whereIn('description', $ids->map(fn ($id) => 'Spesa prodotti #'.$id))
            ->pluck('description')
            ->map(fn ($description) => (int) substr($description, strlen('Spesa prodotti #')));

        return $byStatus->merge($byCash)->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}
