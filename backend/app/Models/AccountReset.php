<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

#[Fillable(['cutoff_date', 'opening_cash_cents', 'opening_cash_movement_id', 'backup_path', 'summary'])]
class AccountReset extends Model
{
    /** Fuso orario in cui i soci inseriscono date e ore (i timestamp sono salvati in UTC). */
    public const LOCAL_TIMEZONE = 'Europe/Rome';

    /** Mezzanotte locale del giorno di taglio, espressa nel fuso dell'applicazione. */
    public static function cutoffMoment(string $date): Carbon
    {
        return Carbon::parse($date, self::LOCAL_TIMEZONE)->startOfDay()->setTimezone(config('app.timezone'));
    }

    protected function casts(): array
    {
        return ['cutoff_date' => 'date', 'summary' => 'array'];
    }

    /** Data dell'ultimo azzeramento conti, o null se non ne e mai stato fatto uno. */
    public static function currentCutoff(): ?Carbon
    {
        $cutoff = static::query()->max('cutoff_date');

        return $cutoff ? self::cutoffMoment(Carbon::parse($cutoff)->toDateString()) : null;
    }
}
