<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('cash_movements')
            ->where('type', 'saldo_iniziale')
            ->where('direction', 'entrata')
            ->where('amount_cents', 2240)
            ->update([
                'amount_cents' => 2130,
                'resulting_balance_cents' => 2130,
            ]);
    }

    public function down(): void
    {
        DB::table('cash_movements')
            ->where('type', 'saldo_iniziale')
            ->where('direction', 'entrata')
            ->where('amount_cents', 2130)
            ->update([
                'amount_cents' => 2240,
                'resulting_balance_cents' => 2240,
            ]);
    }
};
