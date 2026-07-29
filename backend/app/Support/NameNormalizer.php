<?php

namespace App\Support;

use Illuminate\Support\Str;

class NameNormalizer
{
    public static function normalize(string $value): string
    {
        return Str::of($value)->lower()->squish()->ascii()->toString();
    }
}
