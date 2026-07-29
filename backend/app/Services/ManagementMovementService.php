<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ManagementMovementService
{
    public function __construct(private CashService $cashService) {}

    public function create(array $data, User $admin)
    {
        return DB::transaction(function () use ($data, $admin) {
            $cash = $this->cashService->create($data, $admin);

            if (! empty($data['product_id']) && ! empty($data['quantity_purchased'])) {
                if ($data['direction'] !== 'uscita') {
                    throw new RuntimeException('Il carico magazzino collegato a prodotto deve essere una uscita.');
                }

                $product = Product::query()->whereKey($data['product_id'])->lockForUpdate()->firstOrFail();
                $previous = (float) $product->current_quantity;
                $quantity = (float) $data['quantity_purchased'];
                $resulting = $previous + $quantity;

                $updates = ['current_quantity' => $resulting];
                if (isset($data['new_selling_price']) && $data['new_selling_price'] !== '') {
                    $updates['selling_price_cents'] = $this->cashService->toCents($data['new_selling_price']);
                }
                if (isset($data['new_purchase_cost']) && $data['new_purchase_cost'] !== '') {
                    $updates['last_purchase_price_cents'] = $this->cashService->toCents($data['new_purchase_cost']);
                }

                $product->update($updates);

                InventoryMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $admin->id,
                    'cash_movement_id' => $cash->id,
                    'type' => 'acquisto',
                    'quantity' => $quantity,
                    'previous_quantity' => $previous,
                    'resulting_quantity' => $resulting,
                    'note' => $data['note'] ?? null,
                ]);
            }

            return $cash;
        });
    }
}
