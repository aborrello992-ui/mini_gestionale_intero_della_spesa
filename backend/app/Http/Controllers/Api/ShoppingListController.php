<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShoppingListItem;
use Illuminate\Http\Request;

class ShoppingListController extends Controller
{
    public function index(Request $request)
    {
        return ShoppingListItem::with('product:id,name,unit,current_quantity,minimum_threshold', 'user:id,name')
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'suggested_quantity' => ['required', 'numeric', 'min:0.001'],
            'priority' => ['required', 'in:bassa,media,alta'],
            'note' => ['nullable', 'string'],
        ]);

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
            'status' => ['sometimes', 'in:da_acquistare,acquistato,annullato'],
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
}
