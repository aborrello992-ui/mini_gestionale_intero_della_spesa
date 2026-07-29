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
        return $service->counters();
    }

    public function index(Request $request)
    {
        return CashMovement::with('user:id,name', 'member:id,name', 'product:id,name')
            ->when($request->direction, fn ($q, $direction) => $q->where('direction', $direction))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->category, fn ($q, $category) => $q->where('category', $category))
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
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
            'type' => ['required', 'in:versamento,acquisto_prodotti,altra_spesa,rimborso,correzione,annullamento,accredito,quota,spesa_locale,altro'],
            'category' => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
            'movement_date' => ['required', 'date'],
            'movement_time' => ['nullable', 'date_format:H:i'],
            'member_id' => ['nullable', 'exists:users,id'],
            'product_id' => ['nullable', 'exists:products,id'],
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
