<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Salvataggio e diagnosi delle immagini sul disco "public" (locale o Supabase S3).
 */
class StorageHealthService
{
    /**
     * Salva un file sul disco pubblico. Se fallisce lancia un errore leggibile e scrive il dettaglio nel log
     * (con la configurazione "throw=false" Laravel restituirebbe solo false, senza spiegare perche).
     */
    public function store(UploadedFile $file, string $directory): string
    {
        try {
            $path = Storage::disk('public')->putFile($directory, $file);
        } catch (Throwable $exception) {
            Log::error('Salvataggio immagine fallito', ['directory' => $directory, 'error' => $exception->getMessage()]);
            $path = false;
        }

        if (! is_string($path) || $path === '') {
            Log::error('Salvataggio immagine fallito: il disco public ha restituito false', [
                'driver' => config('filesystems.disks.public.driver'),
                'bucket' => config('filesystems.disks.public.bucket'),
            ]);

            throw new RuntimeException("Impossibile salvare l'immagine: l'archivio immagini non risponde. Un admin può usare «Controlla immagini» in Magazzino.");
        }

        return $path;
    }

    /** Prova completa: scrittura, lettura, indirizzo pubblico raggiungibile, cancellazione. */
    public function check(): array
    {
        $disk = Storage::disk('public');
        $driver = (string) config('filesystems.disks.public.driver');
        $path = 'diagnostica/controllo-'.Str::lower(Str::random(10)).'.txt';
        $content = 'controllo '.now()->toIso8601String();
        $steps = [];

        $steps['configurazione'] = $this->configStep($driver);

        try {
            $written = $disk->put($path, $content);
            $steps['scrittura'] = $written
                ? $this->ok('File di prova salvato.')
                : $this->fail('Il salvataggio ha restituito false: chiavi, bucket o endpoint non validi, oppure progetto Supabase in pausa.');
        } catch (Throwable $exception) {
            $written = false;
            $steps['scrittura'] = $this->fail('Errore: '.Str::limit($exception->getMessage(), 300));
        }

        if ($written) {
            try {
                $steps['lettura'] = $disk->get($path) === $content ? $this->ok('File riletto correttamente.') : $this->fail('Il file riletto non coincide.');
            } catch (Throwable $exception) {
                $steps['lettura'] = $this->fail('Errore: '.Str::limit($exception->getMessage(), 300));
            }

            $url = $disk->url($path);
            try {
                $response = Http::timeout(8)->get($url);
                $steps['indirizzo_pubblico'] = $response->successful()
                    ? $this->ok("Raggiungibile: {$url}")
                    : $this->fail("{$url} risponde {$response->status()}: ".$this->publicUrlHint($driver, $response->status()));
            } catch (Throwable $exception) {
                $steps['indirizzo_pubblico'] = $this->fail("{$url} non raggiungibile: ".Str::limit($exception->getMessage(), 200));
            }

            try {
                $disk->delete($path);
                $steps['pulizia'] = $this->ok('File di prova eliminato.');
            } catch (Throwable $exception) {
                $steps['pulizia'] = $this->fail('Errore: '.Str::limit($exception->getMessage(), 200));
            }
        }

        $healthy = collect($steps)->every(fn (array $step) => $step['ok']);

        return [
            'ok' => $healthy,
            'driver' => $driver,
            'summary' => $healthy
                ? 'Le immagini funzionano: salvataggio e visualizzazione ok.'
                : 'Le immagini NON funzionano: guarda il primo passaggio in rosso.',
            'steps' => $steps,
            'php_limits' => [
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
            ],
        ];
    }

    private function configStep(string $driver): array
    {
        if ($driver !== 's3') {
            return $this->ok('Immagini salvate sul disco del server (driver locale). Su Render il disco si svuota a ogni riavvio: usare Supabase.');
        }

        $missing = collect(['key', 'secret', 'bucket', 'endpoint', 'url'])
            ->filter(fn ($key) => blank(config("filesystems.disks.public.{$key}")))
            ->values()->all();

        return $missing === []
            ? $this->ok('Supabase configurato (bucket '.config('filesystems.disks.public.bucket').').')
            : $this->fail('Mancano variabili su Render: '.implode(', ', $missing).' (AWS_* / PUBLIC_FILESYSTEM_URL).');
    }

    private function publicUrlHint(string $driver, int $status): string
    {
        if ($driver === 's3') {
            return match (true) {
                in_array($status, [400, 401, 403], true) => 'il bucket non è pubblico oppure PUBLIC_FILESYSTEM_URL è sbagliato (deve finire con /storage/v1/object/public/<bucket>).',
                $status === 404 => 'PUBLIC_FILESYSTEM_URL non punta al bucket giusto.',
                default => 'Supabase non risponde correttamente (progetto in pausa?).',
            };
        }

        return 'manca il collegamento public/storage (php artisan storage:link) o APP_URL è sbagliato.';
    }

    private function ok(string $message): array
    {
        return ['ok' => true, 'message' => $message];
    }

    private function fail(string $message): array
    {
        return ['ok' => false, 'message' => $message];
    }
}
