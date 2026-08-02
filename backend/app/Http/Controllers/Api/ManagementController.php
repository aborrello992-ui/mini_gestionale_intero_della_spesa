<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ManagementMovementService;
use Illuminate\Http\Request;
use RuntimeException;

class ManagementController extends Controller
{
    public function store(Request $request, ManagementMovementService $service)
    {
        $data = $request->validate([
            'type' => ['required', 'in:accredito,quota,rimborso,correzione,spesa_generica'],
            'direction' => ['required', 'in:entrata,uscita'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'member_id' => ['required_unless:type,spesa_generica', 'nullable', 'exists:users,id'],
            'reason' => ['nullable', 'string', 'max:255'],
            'reverses_movement_id' => ['nullable', 'exists:cash_movements,id'],
            'movement_date' => ['required', 'date'],
            'movement_time' => ['required', 'date_format:H:i'],
        ]);

        if (in_array($data['type'], ['accredito', 'quota'], true)) {
            $data['direction'] = 'entrata';
        }
        if ($data['type'] === 'rimborso') {
            $data['direction'] = 'uscita';
        }

        $labels = [
            'accredito' => 'Accredito',
            'quota' => 'Quota mensile',
            'spesa_generica' => 'Spesa generica',
            'rimborso' => 'Rimborso',
            'correzione' => 'Correzione',
        ];
        $data['description'] = ($data['reason'] ?? null) ?: $labels[$data['type']];
        $data['category'] = $data['type'] === 'spesa_generica' ? 'spesa_generica' : 'movimento_personale';

        try {
            return response()->json($service->create($data, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
