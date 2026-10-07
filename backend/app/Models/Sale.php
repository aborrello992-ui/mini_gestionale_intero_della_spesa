<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['created_by', 'kind', 'total_cents', 'participants_count', 'note', 'archived_at', 'archived_reason'])]
class Sale extends Model
{
    use Archivable;

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class);
    }
}
