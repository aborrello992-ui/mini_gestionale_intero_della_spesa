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
            'type' => ['required', 'in:accredito,quota,spesa_generica,rimborso,correzione,altro'],
            'direction' => ['required', 'in:entrata,uscita'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required_if:type,altro', 'nullable', 'string', 'max:255'],
            'movement_date' => ['required', 'date'],
            'movement_time' => ['required', 'date_format:H:i'],
        ]);

        $labels = [
            'accredito' => 'Accredito',
            'quota' => 'Quota',
            'spesa_generica' => 'Spesa generica',
            'rimborso' => 'Rimborso',
            'correzione' => 'Correzione',
            'altro' => $data['reason'] ?? 'Altro',
        ];
        $data['description'] = $labels[$data['type']];
        $data['category'] = 'gestione';

        try {
            return response()->json($service->create($data, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
