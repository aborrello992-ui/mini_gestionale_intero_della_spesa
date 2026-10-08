<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Gli ospiti esterni non vedono debiti, cassa e storico dei soci. */
class EnsureNotGuest
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->isGuest()) {
            return response()->json(['message' => 'Sezione riservata ai soci.'], 403);
        }

        return $next($request);
    }
}
