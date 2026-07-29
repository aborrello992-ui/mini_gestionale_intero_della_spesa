<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WithdrawalService
{
    public function __construct(private CashService $cashService) {}

    public function take(Product $product, User $member, User $actor, float $quantity, string $paymentStatus, ?string $notes = null): Withdrawal
    {
        if (! in_array($paymentStatus, ['paid', 'coppone'], true)) {
            throw new RuntimeException('Modalita pagamento non valida.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('La quantita deve essere maggiore di zero.');
        }

        return DB::transaction(function () use ($product, $member, $actor, $quantity, $paymentStatus, $notes) {
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $previous = (float) $locked->current_quantity;
            $resulting = $previous - $quantity;

            if ($resulting < 0) {
                throw new RuntimeException('Quantita disponibile insufficiente.');
            }

            $unitPrice = $locked->selling_price_cents ?: $locked->average_price_cents;
            $total = (int) round($quantity * $unitPrice);

            $withdrawal = Withdrawal::create([
                'user_id' => $member->id,
                'product_id' => $locked->id,
                'created_by' => $actor->id,
                'quantity' => $quantity,
                'unit_price_cents' => $unitPrice,
                'total_amount_cents' => $total,
                'payment_status' => $paymentStatus,
                'withdrawn_at' => now(),
                'notes' => $notes,
            ]);

            $locked->update(['current_quantity' => $resulting]);

            $inventoryMovement = InventoryMovement::create([
                'product_id' => $locked->id,
                'user_id' => $member->id,
                'withdrawal_id' => $withdrawal->id,
                'type' => $paymentStatus === 'paid' ? 'prelievo_pagato' : 'prelievo_coppone',
                'quantity' => $quantity,
                'previous_quantity' => $previous,
                'resulting_quantity' => $resulting,
                'unit_price_cents' => $unitPrice,
                'total_amount_cents' => $total,
                'note' => $notes,
            ]);

            if ($paymentStatus === 'paid') {
                $cashMovement = $this->cashService->createFromCents([
                    'amount_cents' => $total,
                    'direction' => 'entrata',
                    'type' => 'prodotto_pagato',
                    'category' => 'prodotti',
                    'description' => "Pagamento {$locked->name}",
                    'movement_date' => now()->toDateString(),
                    'movement_time' => now()->format('H:i:s'),
                    'member_id' => $member->id,
                    'product_id' => $locked->id,
                    'withdrawal_id' => $withdrawal->id,
                    'note' => $notes,
                ], $actor);

                $inventoryMovement->update(['cash_movement_id' => $cashMovement->id]);
            } else {
                MemberDebt::create([
                    'withdrawal_id' => $withdrawal->id,
                    'user_id' => $member->id,
                    'original_amount_cents' => $total,
                    'remaining_amount_cents' => $total,
                    'notes' => $notes,
                ]);
            }

            return $withdrawal->load('member:id,name,avatar_path', 'product');
        });
    }
}
