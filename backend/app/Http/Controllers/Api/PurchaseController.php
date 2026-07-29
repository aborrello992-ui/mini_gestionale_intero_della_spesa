<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\Request;
use RuntimeException;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        return Purchase::with('user:id,name', 'items')
            ->latest()
            ->paginate($request->integer('per_page', 15));
    }

    public function store(Request $request, PurchaseService $service)
    {
        $data = $request->validate([
            'purchased_at' => ['required', 'date'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'receipt_number' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            return response()->json($service->create($data, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function show(Purchase $purchase)
    {
        return $purchase->load('user:id,name', 'items');
    }
}
