<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tabelle i cui record precedenti all'azzeramento vengono archiviati (mai cancellati). */
    private array $tables = ['cash_movements', 'member_debts', 'debt_payments', 'withdrawals', 'restock_sessions', 'inventory_movements'];

    public function up(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->timestamp('archived_at')->nullable()->index();
                $table->string('archived_reason')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropIndex(['archived_at']);
                $table->dropColumn(['archived_at', 'archived_reason']);
            });
        }
    }
};
