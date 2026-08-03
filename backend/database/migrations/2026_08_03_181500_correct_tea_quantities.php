<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'te al limone' => 10,
            'te alla pesca' => 5,
        ] as $normalizedName => $quantity) {
            DB::table('products')
                ->where('normalized_name', $normalizedName)
                ->update(['current_quantity' => $quantity]);
        }
    }

    public function down(): void
    {
        // Real stock corrections should not be automatically reverted.
    }
};
