<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Product;
use App\Services\StorageHealthService;
use App\Support\NameNormalizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('category:id,name', 'location:id,name', 'archivedBy:id,name');

        if (! $request->boolean('include_archived')) {
            $query->active();
        }

        $query->when($request->search, fn ($q, $search) => $q->where('name', 'like', "%{$search}%"))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->location_id, fn ($q, $id) => $q->where('location_id', $id))
            ->when($request->image_state === 'with', fn ($q) => $q->whereNotNull('image_path')->where('image_path', '!=', ''))
            ->when($request->image_state === 'without', fn ($q) => $q->where(fn ($sub) => $sub->whereNull('image_path')->orWhere('image_path', '')))
            ->when($request->state === 'archived', fn ($q) => $q->whereNotNull('archived_at'))
            ->when($request->state === 'empty', fn ($q) => $q->where('current_quantity', '<=', 0)->whereNull('archived_at'))
            ->when($request->state === 'active', fn ($q) => $q->where('is_active', true)->whereNull('archived_at'))
            ->when($request->boolean('low_stock'), fn ($q) => $q->whereColumn('current_quantity', '<=', 'minimum_threshold'));

        $counts = (clone $query)->toBase()
            ->selectRaw('SUM(CASE WHEN current_quantity > 0 THEN 1 ELSE 0 END) as available, SUM(CASE WHEN current_quantity <= 0 THEN 1 ELSE 0 END) as empty')
            ->first();

        match ($request->availability) {
            'available' => $query->where('current_quantity', '>', 0),
            'low' => $query->where('current_quantity', '>', 0)->whereColumn('current_quantity', '<=', 'minimum_threshold'),
            'empty' => $query->where('current_quantity', '<=', 0),
            default => null,
        };

        // Disponibili prima, esauriti in fondo: sul server, cosi vale attraverso tutte le pagine.
        $page = $query->orderByRaw('CASE WHEN current_quantity > 0 THEN 0 ELSE 1 END')
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(min(max($request->integer('per_page', 20), 1), 500));

        return response()->json([
            ...$page->toArray(),
            'availability_counts' => ['available' => (int) ($counts->available ?? 0), 'empty' => (int) ($counts->empty ?? 0)],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $this->normalizePrices($data);
        $this->ensureUniqueNormalizedName($data['name']);
        $warning = $this->similarWarning($data['name']);
        $this->storeImage($request, $data);
        $product = Product::create($data)->load('category:id,name', 'location:id,name');

        return response()->json(['data' => $product, 'warning' => $warning], 201);
    }

    public function show(Product $product)
    {
        return $product->load('category:id,name', 'location:id,name', 'archivedBy:id,name', 'movements.user:id,name');
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validated($request, $product);
        $this->normalizePrices($data);
        $this->ensureUniqueNormalizedName($data['name'], $product->id);
        $warning = $this->similarWarning($data['name'], $product->id);
        $this->storeImage($request, $data, $product);
        $product->update($data);

        return ['data' => $product->fresh()->load('category:id,name', 'location:id,name'), 'warning' => $warning];
    }

    public function destroy(Product $product, Request $request)
    {
        $data = $request->validate(['archive_reason' => ['nullable', 'string', 'max:255']]);
        $product->update([
            'is_active' => false,
            'archived_at' => now(),
            'archived_by' => $request->user()->id,
            'archive_reason' => $data['archive_reason'] ?? null,
        ]);

        return response()->noContent();
    }

    public function forceDestroy(Product $product, Request $request)
    {
        if ($this->hasHistory($product)) {
            return response()->json(['message' => 'Questo prodotto ha uno storico: archivialo invece di eliminarlo.'], 409);
        }

        DB::transaction(function () use ($product, $request) {
            AdminAuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'product_deleted',
                'changes' => ['product_id' => $product->id, 'name' => $product->name, 'deleted_at' => now()->toIso8601String()],
            ]);
            $product->delete();
        });

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        return response()->noContent();
    }

    public function restore(Product $product)
    {
        $product->update(['is_active' => true, 'archived_at' => null, 'archived_by' => null, 'archive_reason' => null]);

        return $product;
    }

    public function image(Request $request, Product $product)
    {
        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'image_alt' => ['nullable', 'string', 'max:255'],
        ]);

        $this->storeImage($request, $data, $product);
        $product->update(['image_path' => $data['image_path'], 'image_alt' => $data['image_alt'] ?? $product->name]);

        return $product->fresh()->load('category:id,name', 'location:id,name');
    }

    public function removeImage(Product $product)
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }
        $product->update(['image_path' => null, 'image_alt' => $product->name]);

        return $product->fresh()->load('category:id,name', 'location:id,name');
    }

    public function quickUpdate(Request $request, Product $product)
    {
        $data = $request->validate([
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'current_quantity' => ['nullable', 'numeric', 'min:0'],
            'minimum_threshold' => ['nullable', 'numeric', 'min:0'],
        ]);
        $this->normalizePrices($data);
        $product->update($data);

        return $product->fresh()->load('category:id,name', 'location:id,name');
    }

    private function hasHistory(Product $product): bool
    {
        // Query dirette: includono anche i record archiviati dall'azzeramento conti.
        foreach (['inventory_movements', 'withdrawals', 'restock_session_items', 'shopping_list_items', 'purchase_items', 'cash_movements'] as $table) {
            if (DB::table($table)->where('product_id', $product->id)->exists()) {
                return true;
            }
        }

        return false;
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        return $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'location_id' => ['required', 'exists:locations,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image' => ['sometimes', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'image_alt' => ['nullable', 'string', 'max:255'],
            'unit' => ['required', Rule::in(['pezzi', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri'])],
            'current_quantity' => ['required', 'numeric', 'min:0'],
            'minimum_threshold' => ['required', 'numeric', 'min:0'],
            'stock_reference_quantity' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
            'selling_price_cents' => ['sometimes', 'integer', 'min:0'],
            'average_price_cents' => ['sometimes', 'integer', 'min:0'],
            'last_purchase_price_cents' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function normalizePrices(array &$data): void
    {
        if (isset($data['selling_price'])) {
            $data['selling_price_cents'] = (int) round(((float) str_replace(',', '.', (string) $data['selling_price'])) * 100);
            unset($data['selling_price']);
        }
    }

    private function storeImage(Request $request, array &$data, ?Product $product = null): void
    {
        unset($data['image']);

        if (! $request->hasFile('image')) {
            return;
        }

        try {
            $path = app(StorageHealthService::class)->store($request->file('image'), 'products');
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages(['image' => $exception->getMessage()]);
        }

        if ($product?->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $data['image_path'] = $path;
        $data['image_alt'] = $data['image_alt'] ?? $data['name'] ?? $product?->name;
    }

    private function ensureUniqueNormalizedName(string $name, ?int $ignoreId = null): void
    {
        $exists = Product::query()
            ->where('normalized_name', NameNormalizer::normalize($name))
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => 'Esiste gia un prodotto con questo nome normalizzato.']);
        }
    }

    private function similarWarning(string $name, ?int $ignoreId = null): ?string
    {
        $normalized = NameNormalizer::normalize($name);
        $similar = Product::query()
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->get(['name', 'normalized_name'])
            ->first(fn ($product) => levenshtein($normalized, $product->normalized_name) <= 2);

        return $similar ? "Esiste gia un prodotto molto simile: {$similar->name}." : null;
    }
}
