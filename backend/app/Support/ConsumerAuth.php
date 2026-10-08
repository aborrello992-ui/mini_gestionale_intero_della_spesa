<?php

namespace App\Support;

use App\Models\User;
use App\Services\PinService;
use Illuminate\Validation\ValidationException;

/**
 * Chi sta prelevando: chi e entrato con il proprio PIN preleva per se stesso senza ridigitarlo;
 * per chiunque altro (o dal dispositivo condiviso) serve il PIN di quella persona.
 */
class ConsumerAuth
{
    public static function resolve(User $actor, int|string $memberId, ?string $pin, string $ip, string $memberField = 'member_id', string $pinField = 'pin'): User
    {
        $member = User::query()->consumers()->find($memberId);
        if (! $member) {
            throw ValidationException::withMessages([$memberField => 'Persona non attiva o accesso ospite scaduto.']);
        }

        if ($actor->isPersonalConsumer() && (int) $actor->id === (int) $member->id) {
            return $member;
        }

        if (blank($pin)) {
            throw ValidationException::withMessages([$pinField => "{$member->name} deve inserire il proprio PIN."]);
        }

        try {
            app(PinService::class)->verify($member, $pin, $ip);
        } catch (ValidationException $exception) {
            throw ValidationException::withMessages([$pinField => "{$member->name}: ".collect($exception->errors())->flatten()->first()]);
        }

        return $member;
    }
}
