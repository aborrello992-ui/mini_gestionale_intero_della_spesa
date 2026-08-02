<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\User;
use App\Services\PinService;
use App\Services\WithdrawalService;
use Illuminate\Http\Request;
use RuntimeException;

class WithdrawalController extends Controller
{
    public function store(Request $request, PinService $pinService, WithdrawalService $withdrawalService)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'member_id' => ['required', 'exists:users,id'],
            'pin' => ['required', 'regex:/^\d{3}$/'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'payment_status' => ['required', 'in:paid,coppone'],
            'notes' => ['nullable', 'string'],
        ]);

        $member = User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->where('can_consume', true)
            ->whereKey($data['member_id'])
            ->firstOrFail();
        $pinService->verify($member, $data['pin'], $request->ip() ?: 'local');

        try {
            $withdrawal = $withdrawalService->take(
                Product::findOrFail($data['product_id']),
                $member,
                $request->user(),
                (float) $data['quantity'],
                $data['payment_status'],
                $data['notes'] ?? null,
            );

            return response()->json($withdrawal, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
