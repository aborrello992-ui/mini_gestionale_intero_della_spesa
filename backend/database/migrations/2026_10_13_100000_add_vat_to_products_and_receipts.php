<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aliquota IVA scritta sullo scontrino (solo controllo: i costi restano IVA inclusa).
     * Il prodotto ricorda l'ultima aliquota usata, lo scontrino il suo "di cui IVA".
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedTinyInteger('vat_rate')->nullable();
        });
        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->unsignedTinyInteger('vat_rate')->nullable();
        });
        Schema::table('restock_sessions', function (Blueprint $table) {
            $table->integer('vat_cents')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn('vat_rate'));
        Schema::table('restock_session_items', fn (Blueprint $table) => $table->dropColumn('vat_rate'));
        Schema::table('restock_sessions', fn (Blueprint $table) => $table->dropColumn('vat_cents'));
    }
};
