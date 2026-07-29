<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InventoryService
{
    public function withdraw(Product $product, User $user, float $quantity, ?string $note = null): InventoryMovement
    {
        if ($quantity <= 0) {
            throw new RuntimeException('La quantita deve essere maggiore di zero.');
        }

        return DB::transaction(function () use ($product, $user, $quantity, $note) {
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $previous = (float) $locked->current_quantity;
            $resulting = $previous - $quantity;

            if ($resulting < 0) {
                throw new RuntimeException('Quantita disponibile insufficiente.');
            }

            $locked->update(['current_quantity' => $resulting]);

            return InventoryMovement::create([
                'product_id' => $locked->id,
                'user_id' => $user->id,
                'type' => 'prelievo',
                'quantity' => $quantity,
                'previous_quantity' => $previous,
                'resulting_quantity' => $resulting,
                'note' => $note,
            ]);
        });
    }

    public function adjust(Product $product, User $user, float $quantity, string $type, ?string $note = null): InventoryMovement
    {
        return DB::transaction(function () use ($product, $user, $quantity, $type, $note) {
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $previous = (float) $locked->current_quantity;
            $delta = $type === 'correzione_negativa' ? -abs($quantity) : abs($quantity);
            $resulting = $previous + $delta;

            if ($resulting < 0) {
                throw new RuntimeException('La correzione porterebbe lo stock sotto zero.');
            }

            $locked->update(['current_quantity' => $resulting]);

            return InventoryMovement::create([
                'product_id' => $locked->id,
                'user_id' => $user->id,
                'type' => $type,
                'quantity' => abs($quantity),
                'previous_quantity' => $previous,
                'resulting_quantity' => $resulting,
                'note' => $note,
            ]);
        });
    }

    public function reverse(InventoryMovement $movement, User $user): InventoryMovement
    {
        if ($movement->status !== 'active') {
            throw new RuntimeException('Movimento gia annullato.');
        }

        return DB::transaction(function () use ($movement, $user) {
            $product = Product::query()->whereKey($movement->product_id)->lockForUpdate()->firstOrFail();
            $previous = (float) $product->current_quantity;
            $delta = match ($movement->type) {
                'prelievo', 'correzione_negativa' => (float) $movement->quantity,
                default => -(float) $movement->quantity,
            };
            $resulting = $previous + $delta;

            if ($resulting < 0) {
                throw new RuntimeException('Annullamento impossibile: lo stock diventerebbe negativo.');
            }

            $product->update(['current_quantity' => $resulting]);
            $movement->update(['status' => 'reversed']);

            return InventoryMovement::create([
                'product_id' => $product->id,
                'user_id' => $user->id,
                'reverses_movement_id' => $movement->id,
                'type' => 'annullamento',
                'quantity' => abs($delta),
                'previous_quantity' => $previous,
                'resulting_quantity' => $resulting,
                'note' => 'Annullamento movimento #'.$movement->id,
            ]);
        });
    }
}
