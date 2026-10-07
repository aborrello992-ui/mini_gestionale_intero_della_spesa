<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Indici per i filtri e i calcoli usati a ogni pagina (saldo, debiti, storico, prodotti). */
    private array $indexes = [
        'cash_movements' => [['status', 'affects_current_balance'], ['member_id', 'type'], ['movement_date'], ['category']],
        'member_debts' => [['user_id', 'status'], ['withdrawal_id']],
        'withdrawals' => [['user_id'], ['withdrawn_at'], ['product_id']],
        'inventory_movements' => [['product_id', 'type'], ['created_at'], ['withdrawal_id']],
        'products' => [['is_active', 'archived_at'], ['current_quantity']],
        'shopping_list_items' => [['status']],
        'restock_session_items' => [['restock_session_id', 'item_type']],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($table, $indexes) {
                foreach ($indexes as $columns) {
                    $blueprint->index($columns, $this->name($table, $columns));
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($table, $indexes) {
                foreach ($indexes as $columns) {
                    $blueprint->dropIndex($this->name($table, $columns));
                }
            });
        }
    }

    private function name(string $table, array $columns): string
    {
        return 'perf_'.$table.'_'.implode('_', $columns);
    }
};
