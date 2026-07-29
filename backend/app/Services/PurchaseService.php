<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\ShoppingListItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PurchaseService
{
    public function __construct(private CashService $cashService) {}

    public function create(array $data, User $user): Purchase
    {
        if (empty($data['items'])) {
            throw new RuntimeException('Inserisci almeno una riga acquisto.');
        }

        return DB::transaction(function () use ($data, $user) {
            $purchase = Purchase::create([
                'user_id' => $user->id,
                'purchased_at' => $data['purchased_at'],
                'supplier' => $data['supplier'] ?? null,
                'receipt_number' => $data['receipt_number'] ?? null,
                'note' => $data['note'] ?? null,
                'total_cents' => 0,
            ]);

            $total = 0;
            foreach ($data['items'] as $item) {
                $quantity = (float) $item['quantity'];
                if ($quantity <= 0) {
                    throw new RuntimeException('Le quantita acquistate devono essere maggiori di zero.');
                }

                $unitCost = $this->cashService->toCents($item['unit_cost']);
                $lineTotal = (int) round($quantity * $unitCost);
                $total += $lineTotal;

                $product = Product::query()->whereKey($item['product_id'])->lockForUpdate()->firstOrFail();
                $previousQuantity = (float) $product->current_quantity;
                $resultingQuantity = $previousQuantity + $quantity;
                $previousValue = $previousQuantity * $product->average_price_cents;
                $newAverage = $resultingQuantity > 0
                    ? (int) round(($previousValue + $lineTotal) / $resultingQuantity)
                    : $unitCost;

                $purchase->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_cost_cents' => $unitCost,
                    'line_total_cents' => $lineTotal,
                ]);

                $product->update([
                    'current_quantity' => $resultingQuantity,
                    'last_purchase_price_cents' => $unitCost,
                    'average_price_cents' => $newAverage,
                ]);

                InventoryMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'purchase_id' => $purchase->id,
                    'type' => 'acquisto',
                    'quantity' => $quantity,
                    'previous_quantity' => $previousQuantity,
                    'resulting_quantity' => $resultingQuantity,
                    'note' => $data['note'] ?? null,
                ]);

                ShoppingListItem::query()
                    ->where('product_id', $product->id)
                    ->where('status', 'da_acquistare')
                    ->update(['status' => 'acquistato', 'completed_at' => now()]);
            }

            $purchase->update(['total_cents' => $total]);

            CashMovement::create([
                'user_id' => $user->id,
                'purchase_id' => $purchase->id,
                'amount_cents' => $total,
                'direction' => 'uscita',
                'type' => 'acquisto_prodotti',
                'category' => 'prodotti',
                'description' => 'Acquisto prodotti #'.$purchase->id,
                'movement_date' => $purchase->purchased_at,
                'note' => $data['note'] ?? null,
            ]);

            return $purchase->load('items');
        });
    }
}
