<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Services\CashService;
use Illuminate\Http\Request;
use RuntimeException;

class CashController extends Controller
{
    public function balance(CashService $service)
    {
        return ['balance_cents' => $service->balanceCents(), 'currency' => 'EUR'];
    }

    public function index(Request $request)
    {
        return CashMovement::with('user:id,name')
            ->when($request->direction, fn ($q, $direction) => $q->where('direction', $direction))
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('movement_date', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('movement_date', '<=', $date))
            ->latest()
            ->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request, CashService $service)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'direction' => ['required', 'in:entrata,uscita'],
            'type' => ['required', 'in:versamento,acquisto_prodotti,altra_spesa,rimborso,correzione,annullamento'],
            'category' => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
            'movement_date' => ['required', 'date'],
            'note' => ['nullable', 'string'],
        ]);

        return response()->json($service->create($data, $request->user()), 201);
    }

    public function reverse(CashMovement $movement, Request $request, CashService $service)
    {
        try {
            return response()->json($service->reverse($movement, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
