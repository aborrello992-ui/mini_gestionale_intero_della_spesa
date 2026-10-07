<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

#[Fillable(['cutoff_date', 'cutoff_at', 'opening_cash_cents', 'opening_cash_movement_id', 'backup_path', 'summary'])]
class AccountReset extends Model
{
    /** Fuso orario in cui i soci inseriscono date e ore (i timestamp sono salvati in UTC). */
    public const LOCAL_TIMEZONE = 'Europe/Rome';

    protected function casts(): array
    {
        return ['cutoff_date' => 'date', 'cutoff_at' => 'datetime', 'summary' => 'array'];
    }

    /** "2026-10-05" (mezzanotte) o "2026-10-05 19:34" in ora italiana, espresso nel fuso dell'applicazione. */
    public static function cutoffMoment(string $local): Carbon
    {
        $moment = strlen(trim($local)) <= 10
            ? Carbon::parse($local, self::LOCAL_TIMEZONE)->startOfDay()
            : Carbon::parse($local, self::LOCAL_TIMEZONE)->startOfMinute();

        return $moment->setTimezone(config('app.timezone'));
    }

    /** Momento dell'ultimo azzeramento conti, o null se non ne e mai stato fatto uno. */
    public static function currentCutoff(): ?Carbon
    {
        $reset = static::query()->orderByDesc('cutoff_date')->orderByDesc('id')->first();
        if (! $reset) {
            return null;
        }

        return $reset->cutoff_at ?? self::cutoffMoment($reset->cutoff_date->toDateString());
    }
}
