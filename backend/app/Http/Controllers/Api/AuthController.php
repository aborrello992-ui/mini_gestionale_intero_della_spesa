<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PinService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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

    public function guest()
    {
        $guest = User::firstOrCreate(
            ['email' => 'guest-device@locale.test'],
            [
                'name' => 'Ospite Locale',
                'password' => bin2hex(random_bytes(16)),
                'role' => User::ROLE_DEVICE,
                'is_active' => true,
            ],
        );

        return [
            'token' => $guest->createToken('guest-device')->plainTextToken,
            'user' => $guest,
        ];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logout effettuato.']);
    }

    public function me(Request $request)
    {
        return $request->user();
    }
}
