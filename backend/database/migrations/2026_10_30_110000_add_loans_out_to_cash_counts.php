<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Soldi fuori dal cassetto (prestiti da restituire) al momento del conteggio.
        Schema::table('cash_counts', function (Blueprint $table) {
            $table->unsignedInteger('loans_out_cents')->default(0)->after('app_balance_cents');
        });
    }

    public function down(): void
    {
        Schema::table('cash_counts', function (Blueprint $table) {
            $table->dropColumn('loans_out_cents');
        });
    }
};
