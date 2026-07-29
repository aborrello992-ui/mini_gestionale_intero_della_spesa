<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Credenziali non valide.']);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => 'Account disattivato.']);
        }

        return [
            'token' => $user->createToken('locale-web')->plainTextToken,
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
