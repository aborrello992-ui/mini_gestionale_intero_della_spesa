<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $userId = DB::table('users')
                ->where('role', 'admin')
                ->where('is_active', true)
                ->value('id')
                ?? DB::table('users')->where('is_active', true)->value('id')
                ?? DB::table('users')->value('id');

            if ($userId === null) {
                return;
            }

            DB::table('products')
                ->where('current_quantity', '>', 0)
                ->orderBy('id')
                ->lockForUpdate()
                ->each(function (object $product) use ($userId) {
                    $quantity = (float) $product->current_quantity;

                    DB::table('inventory_movements')->insert([
                        'product_id' => $product->id,
                        'user_id' => $userId,
                        'type' => 'correzione_negativa',
                        'quantity' => $quantity,
                        'previous_quantity' => $quantity,
                        'resulting_quantity' => 0,
                        'note' => 'Azzeramento inventario richiesto dall amministratore',
                        'status' => 'active',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    DB::table('products')
                        ->where('id', $product->id)
                        ->update([
                            'current_quantity' => 0,
                            'updated_at' => now(),
                        ]);
                });
        });
    }

    public function down(): void
    {
        // A real inventory reset must not be automatically reversed.
    }
};
