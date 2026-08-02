<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\ShoppingListItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class RestockSessionService
{
    public function __construct(private CashService $cashService) {}

    public function register(array $data, User $admin): RestockSession
    {
        return DB::transaction(function () use ($data, $admin) {
            $totalCents = $this->cashService->toCents($data['total_amount']);

            $session = RestockSession::create([
                'user_id' => $admin->id,
                'total_cents' => $totalCents,
                'difference_cents' => $this->lineItemsDifferenceCents($data['items'], $totalCents),
                'difference_reason' => $data['difference_reason'] ?? null,
                'purchased_at' => $data['purchased_at'],
                'purchased_time' => $data['purchased_time'],
                'receipt_image_path' => $data['receipt_image_path'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $cashMovement = $this->cashService->createFromCents([
                'amount_cents' => $totalCents,
                'direction' => 'uscita',
                'type' => 'acquisto_prodotti',
                'category' => 'lista_spesa',
                'description' => 'Spesa prodotti #'.$session->id,
                'movement_date' => $data['purchased_at'],
                'movement_time' => $data['purchased_time'],
                'note' => $data['note'] ?? null,
            ], $admin);

            foreach ($data['items'] as $item) {
                $product = isset($item['product_id']) && $item['product_id']
                    ? Product::query()->whereKey($item['product_id'])->lockForUpdate()->firstOrFail()
                    : $this->createProductFromItem($item);

                $quantity = isset($item['quantity']) && (float) $item['quantity'] > 0
                    ? (float) $item['quantity']
                    : (float) ($item['package_count'] ?? 0) * (float) ($item['pieces_per_package'] ?? 0);
                if ($quantity <= 0) {
                    throw new RuntimeException('La quantita acquistata deve essere maggiore di zero.');
                }

                $previous = (float) $product->current_quantity;
                $resulting = $previous + $quantity;
                $lineCostCents = ! blank($item['cost_amount'] ?? null) ? $this->cashService->toCents($item['cost_amount']) : null;
                $unitCostCents = $lineCostCents ? (int) round($lineCostCents / $quantity) : null;
                $previousAverage = (int) ($product->average_price_cents ?? 0);
                $newAverage = $unitCostCents ? $this->weightedAverageCost($previous, $previousAverage, $quantity, $unitCostCents) : $previousAverage;

                $updates = ['current_quantity' => $resulting];
                if (! blank($item['selling_price'] ?? null)) {
                    $updates['selling_price_cents'] = $this->cashService->toCents($item['selling_price']);
                }
                if ($unitCostCents) {
                    $updates['last_purchase_price_cents'] = $unitCostCents;
                    $updates['average_price_cents'] = $newAverage;
                }
                $product->update($updates);

                $sessionItem = $session->items()->create([
                    'product_id' => $product->id,
                    'shopping_list_item_id' => $item['shopping_list_item_id'] ?? null,
                    'package_count' => $item['package_count'] ?? null,
                    'pieces_per_package' => $item['pieces_per_package'] ?? null,
                    'quantity' => $quantity,
                    'selling_price_cents' => $updates['selling_price_cents'] ?? null,
                    'cost_cents' => $lineCostCents,
                    'unit_cost_cents' => $unitCostCents,
                    'previous_average_cost_cents' => $previousAverage,
                    'new_average_cost_cents' => $newAverage,
                ]);

                InventoryMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $admin->id,
                    'cash_movement_id' => $cashMovement->id,
                    'type' => 'rifornimento',
                    'quantity' => $quantity,
                    'previous_quantity' => $previous,
                    'resulting_quantity' => $resulting,
                    'note' => 'Sessione spesa #'.$session->id.' riga #'.$sessionItem->id,
                ]);

                if (! empty($item['shopping_list_item_id'])) {
                    ShoppingListItem::whereKey($item['shopping_list_item_id'])->update([
                        'status' => 'acquistato',
                        'purchased_quantity' => $quantity,
                        'completed_at' => now(),
                        'restock_session_id' => $session->id,
                    ]);
                }
            }

            return $session->load('items');
        });
    }

    private function createProductFromItem(array $item): Product
    {
        $category = Category::firstOrCreate(['name' => $item['category'] ?? 'Altro']);
        $location = blank($item['location'] ?? null)
            ? Location::firstOrCreate(['name' => 'Locale'])
            : Location::firstOrCreate(['name' => $item['location']]);

        return Product::create([
            'name' => $item['name'],
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit' => $item['unit'],
            'current_quantity' => 0,
            'minimum_threshold' => $item['minimum_threshold'] ?? 1,
            'stock_reference_quantity' => max((float) ($item['quantity'] ?? 1), 10),
            'selling_price_cents' => $this->cashService->toCents($item['selling_price']),
            'image_path' => isset($item['image']) ? $item['image']->store('products', 'public') : null,
            'image_alt' => $item['name'],
        ]);
    }

    private function weightedAverageCost(float $previousQuantity, int $previousAverageCents, float $newQuantity, int $newUnitCostCents): int
    {
        if ($previousQuantity <= 0 || $previousAverageCents <= 0) {
            return $newUnitCostCents;
        }

        return (int) round((($previousQuantity * $previousAverageCents) + ($newQuantity * $newUnitCostCents)) / ($previousQuantity + $newQuantity));
    }

    private function lineItemsDifferenceCents(array $items, int $totalCents): int
    {
        $lineTotal = collect($items)->sum(fn (array $item) => blank($item['cost_amount'] ?? null) ? 0 : $this->cashService->toCents($item['cost_amount']));

        return $totalCents - $lineTotal;
    }
}
