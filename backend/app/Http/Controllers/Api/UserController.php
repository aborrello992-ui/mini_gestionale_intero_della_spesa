<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return User::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'aliases' => ['nullable', 'array'],
            'aliases.*' => ['string', 'max:80'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_MEMBER])],
            'is_active' => ['sometimes', 'boolean'],
            'pin' => ['nullable', 'regex:/^\d{3}$/'],
        ]);

        if (! empty($data['pin'])) {
            $data['pin_hash'] = $data['pin'];
        }
        unset($data['pin']);

        return response()->json(User::create($data), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'aliases' => ['nullable', 'array'],
            'aliases.*' => ['string', 'max:80'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_MEMBER])],
            'is_active' => ['required', 'boolean'],
            'pin' => ['nullable', 'regex:/^\d{3}$/'],
        ]);

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        if (! empty($data['pin'])) {
            $data['pin_hash'] = $data['pin'];
        }
        unset($data['pin']);

        $user->update($data);

        return $user;
    }

    public function updatePin(Request $request, User $user)
    {
        $data = $request->validate([
            'pin' => ['required', 'regex:/^\d{3}$/', 'confirmed'],
        ]);

        $user->update(['pin_hash' => $data['pin']]);

        return ['message' => 'PIN aggiornato correttamente.'];
    }
}
