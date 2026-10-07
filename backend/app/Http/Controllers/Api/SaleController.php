<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PinService;
use App\Services\SaleService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class SaleController extends Controller
{
    /** Acquisto di prodotti e/o combo, da soli o divisi fra piu soci: ognuno conferma con il proprio PIN. */
    public function store(Request $request, SaleService $service, PinService $pinService)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.product_id' => ['nullable', 'required_without:items.*.combo_id', 'exists:products,id'],
            'items.*.combo_id' => ['nullable', 'required_without:items.*.product_id', 'exists:combos,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'participants' => ['required', 'array', 'min:1', 'max:'.SaleService::MAX_PARTICIPANTS],
            'participants.*.member_id' => ['required', 'distinct', 'exists:users,id'],
            'participants.*.pin' => ['required', 'regex:/^\d{3}$/'],
            'participants.*.payment_status' => ['required', 'in:paid,coppone'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'participants.*.member_id.distinct' => 'La stessa persona è inserita due volte.',
            'participants.*.pin.required' => 'Ogni persona deve inserire il proprio PIN.',
            'participants.*.pin.regex' => 'Il PIN deve avere 3 cifre.',
        ]);

        $participants = [];
        foreach ($data['participants'] as $index => $participant) {
            $member = User::query()
                ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
                ->where('is_active', true)
                ->where('can_consume', true)
                ->find($participant['member_id']);
            if (! $member) {
                throw ValidationException::withMessages(["participants.$index.member_id" => 'Socio non attivo.']);
            }
            try {
                $pinService->verify($member, $participant['pin'], $request->ip() ?: 'local');
            } catch (ValidationException $exception) {
                throw ValidationException::withMessages(["participants.$index.pin" => "{$member->name}: ".collect($exception->errors())->flatten()->first()]);
            }
            $participants[] = ['member' => $member, 'payment_status' => $participant['payment_status']];
        }

        try {
            return response()->json($service->checkout($data['items'], $participants, $request->user(), $data['note'] ?? null), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
