<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\GuestAccessService;
use App\Services\PinService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class AuthController extends Controller
{
    public function login(Request $request, PinService $pinService)
    {
        $data = $request->validate([
            'member_id' => ['required', 'exists:users,id'],
            'pin' => ['required', 'regex:/^\d{3}$/'],
        ]);

        $user = User::findOrFail($data['member_id']);

        if (! $user->is_active || ! $user->can_consume) {
            throw ValidationException::withMessages(['member_id' => 'Membro non attivo.']);
        }

        if (! in_array($user->role, [User::ROLE_ADMIN, User::ROLE_MEMBER], true)) {
            throw ValidationException::withMessages(['member_id' => 'Questo utente non può accedere da qui.']);
        }

        $pinService->verify($user, $data['pin'], $request->ip() ?: 'local');

        return [
            'token' => $user->createToken($user->isAdmin() ? 'admin-pin-session' : 'member-pin-session')->plainTextToken,
            'user' => $user,
        ];
    }

    /** Ospite esterno: accesso temporaneo con PIN generato, mostrato una sola volta. */
    public function guest(Request $request, GuestAccessService $guests)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:40', 'regex:/^[\pL\pM\s\'.-]+$/u'],
        ], [
            'name.required' => 'Scrivi il tuo nome per entrare come ospite.',
            'name.min' => 'Il nome deve avere almeno 2 lettere.',
            'name.regex' => 'Il nome può contenere solo lettere, spazi, apostrofi e trattini.',
        ]);

        try {
            $access = $guests->create($data['name']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        return [
            'token' => $access['token'],
            'user' => $access['user'],
            'pin' => $access['pin'],
            'expires_at' => $access['user']->guest_expires_at,
        ];
    }

    public function logout(Request $request, GuestAccessService $guests)
    {
        $user = $request->user();
        $user->currentAccessToken()?->delete();
        if ($user->isGuest()) {
            $guests->end($user);
        }

        return response()->json(['message' => 'Logout effettuato.']);
    }

    public function me(Request $request)
    {
        return $request->user();
    }
}
