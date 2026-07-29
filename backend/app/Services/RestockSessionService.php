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
                'purchased_at' => $data['purchased_at'],
                'purchased_time' => $data['purchased_time'],
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

                $quantity = (float) $item['quantity'];
                if ($quantity <= 0) {
                    throw new RuntimeException('La quantita acquistata deve essere maggiore di zero.');
                }

                $previous = (float) $product->current_quantity;
                $resulting = $previous + $quantity;

                $updates = ['current_quantity' => $resulting];
                if (! blank($item['selling_price'] ?? null)) {
                    $updates['selling_price_cents'] = $this->cashService->toCents($item['selling_price']);
                }
                $product->update($updates);

                $sessionItem = $session->items()->create([
                    'product_id' => $product->id,
                    'shopping_list_item_id' => $item['shopping_list_item_id'] ?? null,
                    'quantity' => $quantity,
                    'selling_price_cents' => $updates['selling_price_cents'] ?? null,
                    'cost_cents' => ! blank($item['cost_amount'] ?? null) ? $this->cashService->toCents($item['cost_amount']) : null,
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
            'image_alt' => $item['name'],
        ]);
    }
}
