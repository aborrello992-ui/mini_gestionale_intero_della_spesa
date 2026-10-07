<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

/**
 * Link firmato a un'immagine servita dal backend (MediaController).
 * Funziona anche con bucket Supabase privato: il server legge il file con le sue chiavi.
 * La firma non scade, cosi il browser puo tenere l'immagine in cache, ma non si puo indovinare.
 */
class MediaUrl
{
    public const ALLOWED_DIRECTORIES = ['products/', 'receipts/'];

    public static function for(?string $path): ?string
    {
        if (blank($path)) {
            return null;
        }

        return url(URL::signedRoute('media.show', ['path' => $path], absolute: false));
    }
}
