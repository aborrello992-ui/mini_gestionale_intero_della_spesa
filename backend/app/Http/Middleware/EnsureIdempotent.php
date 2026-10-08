<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protezione anti-doppione. Se la richiesta porta l'header Idempotency-Key:
 *  - la prima volta l'operazione viene eseguita e la risposta salvata;
 *  - un nuovo invio con lo stesso codice riceve la risposta salvata, senza rifare l'operazione;
 *  - se la prima è ancora in corso risponde 409 (code=in_progress): l'app riprova dopo qualche secondo;
 *  - se l'operazione fallisce il codice viene liberato, così si può riprovare.
 * Il lavoro della richiesta NON viene avvolto in una transazione: i tentativi di PIN sbagliati restano contati.
 */
class EnsureIdempotent
{
    private const KEEP_DAYS = 7;

    private const STALE_MINUTES = 5;

    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header('Idempotency-Key'));
        if ($key === '') {
            return $next($request);
        }
        if (strlen($key) > 100) {
            return response()->json(['message' => 'Codice anti-doppione non valido.'], 422);
        }

        $endpoint = $request->method().' '.$request->path();
        $userId = $request->user()?->id;

        DB::table('idempotency_keys')->where('created_at', '<', now()->subDays(self::KEEP_DAYS))->delete();

        try {
            $id = DB::table('idempotency_keys')->insertGetId([
                'key' => $key,
                'user_id' => $userId,
                'endpoint' => $endpoint,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            return $this->previous($key, $userId, $endpoint);
        }

        try {
            $response = $next($request);
        } catch (\Throwable $exception) {
            DB::table('idempotency_keys')->where('id', $id)->delete();
            throw $exception;
        }

        if ($response->getStatusCode() >= 400) {
            // Operazione non riuscita: il codice si libera e si può riprovare.
            DB::table('idempotency_keys')->where('id', $id)->delete();
        } else {
            DB::table('idempotency_keys')->where('id', $id)->update([
                'status_code' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $response;
    }

    private function previous(string $key, ?int $userId, string $endpoint): Response
    {
        $row = DB::table('idempotency_keys')->where('key', $key)->first();

        if (! $row || (int) $row->user_id !== (int) $userId || $row->endpoint !== $endpoint) {
            return response()->json(['message' => 'Codice anti-doppione già usato per un\'altra operazione.'], 422);
        }

        if ($row->completed_at !== null) {
            return response((string) $row->response_body, (int) $row->status_code, [
                'Content-Type' => 'application/json',
                'Idempotent-Replayed' => 'true',
            ]);
        }

        if (now()->subMinutes(self::STALE_MINUTES)->greaterThan($row->created_at)) {
            return response()->json([
                'message' => 'Non è certo che l\'operazione sia andata a buon fine: controlla lo storico prima di rifarla.',
                'code' => 'unknown',
            ], 409);
        }

        return response()->json(['message' => 'Operazione già in corso: attendi qualche secondo.', 'code' => 'in_progress'], 409);
    }
}
