<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use RuntimeException;

class InventoryController extends Controller
{
    public function withdraw(Request $request, InventoryService $service)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            $movement = $service->withdraw(Product::findOrFail($data['product_id']), $request->user(), (float) $data['quantity'], $data['note'] ?? null);

            return response()->json($movement->load('product:id,name,unit'), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function adjust(Request $request, InventoryService $service)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'type' => ['required', 'in:correzione_positiva,correzione_negativa'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            return response()->json($service->adjust(Product::findOrFail($data['product_id']), $request->user(), (float) $data['quantity'], $data['type'], $data['note'] ?? null), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function movements(Request $request)
    {
        $query = InventoryMovement::with('product.category:id,name', 'product:id,name,unit,category_id', 'user:id,name');
        $this->applyFilters($query, $request);

        return $query->latest()->paginate($request->integer('per_page', 20));
    }

    public function reverse(InventoryMovement $movement, Request $request, InventoryService $service)
    {
        try {
            return response()->json($service->reverse($movement, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function lowStock(Request $request)
    {
        return Product::with('category:id,name', 'location:id,name')
            ->active()
            ->whereColumn('current_quantity', '<=', 'minimum_threshold')
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->location_id, fn ($q, $id) => $q->where('location_id', $id))
            ->orderByRaw('(current_quantity - minimum_threshold) asc')
            ->paginate($request->integer('per_page', 20));
    }

    private function applyFilters($query, Request $request): void
    {
        $query->when($request->date_from, fn ($q, $date) => $q->whereDate('created_at', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('created_at', '<=', $date))
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type));
    }
}
