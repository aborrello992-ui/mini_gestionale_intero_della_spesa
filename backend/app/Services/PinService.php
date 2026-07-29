<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PinService
{
    public function verify(User $member, string $pin, string $fingerprint): void
    {
        if (! preg_match('/^\d{3}$/', $pin)) {
            throw ValidationException::withMessages(['pin' => 'Il PIN deve contenere esattamente tre cifre.']);
        }

        $key = "pin_attempts:{$member->id}:{$fingerprint}";
        if ((int) Cache::get($key, 0) >= 5) {
            throw ValidationException::withMessages(['pin' => 'Troppi tentativi errati. Riprova tra qualche minuto.']);
        }

        if (! $member->pin_hash || ! Hash::check($pin, $member->pin_hash)) {
            Cache::put($key, (int) Cache::get($key, 0) + 1, now()->addMinutes(5));
            throw ValidationException::withMessages(['pin' => 'PIN non valido.']);
        }

        Cache::forget($key);
    }
}
