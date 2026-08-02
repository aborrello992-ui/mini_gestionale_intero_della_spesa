<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use App\Services\PinService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return User::whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])->orderBy('name')->get();
    }

    public function store(Request $request, PinService $pinService)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'aliases' => ['nullable', 'array'],
            'aliases.*' => ['string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_MEMBER])],
            'is_active' => ['sometimes', 'boolean'],
            'pin' => ['required', 'regex:/^\d{3}$/', 'confirmed'],
        ]);

        $pinService->ensureUniqueForActiveConsumer($data['pin']);
        $data['pin_hash'] = $data['pin'];
        $data['email'] = $data['email'] ?? $this->generatedEmail($data['name'], $data['last_name'] ?? null);
        $data['password'] = $data['password'] ?? Str::password(32);
        $data['can_consume'] = true;
        unset($data['pin']);
        unset($data['pin_confirmation']);

        $user = User::create($data);
        $this->audit($request, $user, 'user_created', $data);

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'aliases' => ['nullable', 'array'],
            'aliases.*' => ['string', 'max:80'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_MEMBER])],
            'is_active' => ['required', 'boolean'],
        ]);

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }
        $data['can_consume'] = true;

        $before = $user->only(['name', 'last_name', 'aliases', 'email', 'role', 'is_active']);
        $user->update($data);
        $this->audit($request, $user, 'user_updated', ['before' => $before, 'after' => $user->only(array_keys($before))]);

        return $user;
    }

    public function updatePin(Request $request, User $user, PinService $pinService)
    {
        $data = $request->validate([
            'pin' => ['required', 'regex:/^\d{3}$/', 'confirmed'],
        ]);

        $pinService->ensureUniqueForActiveConsumer($data['pin'], $user->id);
        $user->update(['pin_hash' => $data['pin']]);
        $this->audit($request, $user, 'pin_updated', ['pin_changed' => true]);

        return ['message' => 'PIN aggiornato correttamente.'];
    }

    private function generatedEmail(string $name, ?string $lastName): string
    {
        $base = Str::slug(trim($name.' '.($lastName ?? ''))) ?: 'membro';
        $email = "{$base}@locale.test";
        $counter = 1;
        while (User::where('email', $email)->exists()) {
            $email = "{$base}-{$counter}@locale.test";
            $counter++;
        }

        return $email;
    }

    private function audit(Request $request, User $target, string $action, array $changes): void
    {
        AdminAuditLog::create([
            'admin_id' => $request->user()->id,
            'target_user_id' => $target->id,
            'action' => $action,
            'changes' => $changes,
        ]);
    }
}
