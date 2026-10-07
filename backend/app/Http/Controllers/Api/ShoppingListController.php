<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRestockRequest;
use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Support\NameNormalizer;
use App\Services\CashService;
use App\Services\RestockSessionService;
use Illuminate\Http\Request;
use RuntimeException;

class ShoppingListController extends Controller
{
    public function index(Request $request)
    {
        return ShoppingListItem::with('product:id,name,unit,current_quantity,minimum_threshold,selling_price_cents,average_price_cents,category_id', 'product.category:id,name', 'user:id,name')
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 20), 1), 200));
    }

    /** Promemoria automatici: prodotti attivi sotto scorta o esauriti non ancora in lista. */
    public function reminders()
    {
        $listed = ShoppingListItem::query()->whereIn('status', ['da_acquistare', 'selezionato'])->whereNotNull('product_id')->pluck('product_id');

        return Product::query()
            ->active()
            ->with('category:id,name')
            ->whereColumn('current_quantity', '<=', 'minimum_threshold')
            ->whereNotIn('id', $listed)
            ->orderBy('current_quantity')
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'current_quantity', 'minimum_threshold', 'selling_price_cents', 'average_price_cents', 'category_id']);
    }

    public function store(Request $request)
    {
        foreach (['estimated_price', 'suggested_quantity'] as $field) {
            if (is_string($request->input($field))) {
                $request->merge([$field => str_replace(',', '.', trim($request->input($field)))]);
            }
        }

        $data = $request->validate([
            'product_id' => ['nullable', 'required_without:suggested_name', 'exists:products,id'],
            'suggested_name' => ['nullable', 'required_without:product_id', 'string', 'max:120'],
            'suggested_category' => ['nullable', 'string', 'max:80'],
            'suggested_quantity' => ['required', 'numeric', 'min:0.001'],
            'estimated_price' => ['nullable', 'numeric', 'min:0'],
            'priority' => ['required', 'in:bassa,media,alta'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'suggested_name.required_without' => 'Scrivi il nome del prodotto da comprare.',
            'product_id.required_without' => 'Scegli o scrivi il prodotto da comprare.',
        ]);

        // Un nome che corrisponde a un prodotto esistente viene collegato a quel prodotto.
        if (empty($data['product_id']) && ! empty($data['suggested_name'])) {
            $existing = Product::query()->where('normalized_name', NameNormalizer::normalize($data['suggested_name']))->first();
            if ($existing) {
                $data['product_id'] = $existing->id;
            }
        }

        if (isset($data['estimated_price'])) {
            $data['estimated_price_cents'] = app(CashService::class)->toCents($data['estimated_price']);
        }
        unset($data['estimated_price']);

        if (! empty($data['product_id'])) {
            $data['suggested_name'] = null;
            $item = ShoppingListItem::updateOrCreate(
                ['product_id' => $data['product_id'], 'status' => 'da_acquistare'],
                [...$data, 'user_id' => $request->user()->id]
            );
        } else {
            $item = ShoppingListItem::create([...$data, 'user_id' => $request->user()->id, 'status' => 'da_acquistare']);
        }

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

    public function registerRestock(RegisterRestockRequest $request, RestockSessionService $service)
    {
        try {
            [$session, $created] = $service->register($request->validated(), $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json($session, $created ? 201 : 200);
    }
}
