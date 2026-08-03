<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShoppingListItem;
use App\Services\CashService;
use App\Services\RestockSessionService;
use Illuminate\Http\Request;

class ShoppingListController extends Controller
{
    public function index(Request $request)
    {
        return ShoppingListItem::with('product:id,name,unit,current_quantity,minimum_threshold,selling_price_cents', 'user:id,name')
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'suggested_quantity' => ['required', 'numeric', 'min:0.001'],
            'estimated_price' => ['nullable', 'numeric', 'min:0'],
            'priority' => ['required', 'in:bassa,media,alta'],
            'note' => ['nullable', 'string'],
        ]);

        if (isset($data['estimated_price'])) {
            $data['estimated_price_cents'] = app(CashService::class)->toCents($data['estimated_price']);
            unset($data['estimated_price']);
        }

        $item = ShoppingListItem::updateOrCreate(
            ['product_id' => $data['product_id'], 'status' => 'da_acquistare'],
            [...$data, 'user_id' => $request->user()->id]
        );

        return response()->json($item->load('product:id,name,unit'), $item->wasRecentlyCreated ? 201 : 200);
    }

    public function update(Request $request, ShoppingListItem $item)
    {
        $item->update($request->validate([
            'suggested_quantity' => ['sometimes', 'numeric', 'min:0.001'],
            'priority' => ['sometimes', 'in:bassa,media,alta'],
            'note' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:da_acquistare,selezionato,acquistato,annullato'],
        ]));

        if (in_array($item->status, ['acquistato', 'annullato'], true) && ! $item->completed_at) {
            $item->update(['completed_at' => now()]);
        }

        return $item->fresh()->load('product:id,name,unit');
    }

    public function destroy(ShoppingListItem $item)
    {
        $item->update(['status' => 'annullato', 'completed_at' => now()]);

        return response()->noContent();
    }

    public function registerRestock(Request $request, RestockSessionService $service)
    {
        $data = $request->validate([
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'purchased_at' => ['required', 'date'],
            'purchased_time' => ['required', 'date_format:H:i'],
            'receipt_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'note' => ['nullable', 'string'],
            'difference_reason' => ['nullable', 'in:arrotondamento,sacchetto,sconto,altro_costo,errore'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.shopping_list_item_id' => ['nullable', 'exists:shopping_list_items,id'],
            'items.*.product_id' => ['nullable', 'exists:products,id'],
            'items.*.name' => ['required_without:items.*.product_id', 'string', 'max:255'],
            'items.*.category' => ['nullable', 'string', 'max:255'],
            'items.*.unit' => ['required_without:items.*.product_id', 'string', 'max:40'],
            'items.*.package_count' => ['nullable', 'numeric', 'min:0'],
            'items.*.pieces_per_package' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0.001'],
            'items.*.minimum_threshold' => ['nullable', 'numeric', 'min:0'],
            'items.*.selling_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.cost_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.location' => ['nullable', 'string', 'max:255'],
            'items.*.image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        if ($request->hasFile('receipt_image')) {
            $data['receipt_image_path'] = $request->file('receipt_image')->store('receipts', 'public');
        }

        return response()->json($service->register($data, $request->user()), 201);
    }
}
