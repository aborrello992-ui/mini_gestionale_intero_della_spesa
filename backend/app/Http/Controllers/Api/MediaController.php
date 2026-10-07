<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class MediaController extends Controller
{
    /** Immagine di prodotto o scontrino letta dal disco public (locale o Supabase). Richiede link firmato. */
    public function show(Request $request)
    {
        return $this->serve((string) $request->query('path'));
    }

    /**
     * Vecchi link /storage/... (versioni precedenti del frontend): la foto viene presa dal disco
     * public anche se sta su Supabase. I nomi dei file sono casuali (40 caratteri), quindi non indovinabili.
     */
    public function legacy(string $path)
    {
        return $this->serve($path);
    }

    private function serve(string $path)
    {
        if ($path === '' || str_contains($path, '..') || ! Str::startsWith($path, MediaUrl::ALLOWED_DIRECTORIES)) {
            abort(404);
        }

        try {
            $disk = Storage::disk('public');
            if (! $disk->exists($path)) {
                abort(404);
            }

            return $disk->response($path, basename($path), [
                'Cache-Control' => 'private, max-age=604800, immutable',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);
            abort(502, 'Archivio immagini non raggiungibile.');
        }
    }
}
