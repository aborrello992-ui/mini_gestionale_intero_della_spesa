<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Ospiti esterni: ogni ingresso crea un ospite temporaneo con un PIN di 3 cifre unico,
 * mostrato una sola volta. Paga subito (niente coppone) e usa il PIN per "Mangia con un amico".
 */
class GuestAccessService
{
    public const HOURS = 12;

    /** @return array{user: User, pin: string, token: string} */
    public function create(): array
    {
        return DB::transaction(function () {
            $this->expireOld();
            $pin = $this->uniquePin();
            $number = User::query()->where('role', User::ROLE_GUEST)->count() + 1;

            $guest = User::create([
                'name' => "Ospite {$number}",
                'email' => 'ospite-'.Str::lower(Str::random(12)).'@locale.test',
                'password' => Str::password(32),
                'role' => User::ROLE_GUEST,
                'is_active' => true,
                'can_consume' => true,
                'pin_hash' => $pin,
                'guest_expires_at' => now()->addHours(self::HOURS),
            ]);

            $token = $guest->createToken('guest-pin-session', ['*'], now()->addHours(self::HOURS))->plainTextToken;

            return ['user' => $guest, 'pin' => $pin, 'token' => $token];
        });
    }

    public function end(User $guest): void
    {
        $guest->update(['is_active' => false, 'guest_expires_at' => now()]);
    }

    private function expireOld(): void
    {
        User::query()->where('role', User::ROLE_GUEST)->where('is_active', true)->where('guest_expires_at', '<=', now())->update(['is_active' => false]);
    }

    /** PIN diverso da quello di ogni socio e ospite attivo. */
    private function uniquePin(): string
    {
        $hashes = User::query()->consumers()->whereNotNull('pin_hash')->pluck('pin_hash');
        $candidates = range(0, 999);
        shuffle($candidates);

        foreach (array_slice($candidates, 0, 60) as $number) {
            $pin = str_pad((string) $number, 3, '0', STR_PAD_LEFT);
            if (! $hashes->contains(fn ($hash) => Hash::check($pin, $hash))) {
                return $pin;
            }
        }

        throw new RuntimeException('Impossibile generare un PIN libero: riprova.');
    }
}
