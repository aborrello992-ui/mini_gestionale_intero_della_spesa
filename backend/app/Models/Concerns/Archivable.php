<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * Record archiviati dall'azzeramento conti: esclusi da saldi, debiti, crediti, contatori e liste.
 * Per consultarli: Model::onlyArchived() (sezione admin "Archivio conti precedenti").
 */
trait Archivable
{
    public const ARCHIVE_SCOPE = 'not_archived';

    public static function bootArchivable(): void
    {
        static::addGlobalScope(self::ARCHIVE_SCOPE, function (Builder $query) {
            $query->whereNull($query->getModel()->qualifyColumn('archived_at'));
        });
    }

    public static function onlyArchived(): Builder
    {
        return static::query()->withoutGlobalScope(self::ARCHIVE_SCOPE)->whereNotNull('archived_at');
    }

    public static function withArchived(): Builder
    {
        return static::query()->withoutGlobalScope(self::ARCHIVE_SCOPE);
    }
}
