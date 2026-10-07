<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->string('item_type', 20)->default('product');
            $table->string('expense_category', 40)->nullable();
            $table->string('description')->nullable();
        });

        // Le righe "expense" (sacchetti, pulizia...) non hanno prodotto ne quantita.
        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->change();
            $table->decimal('quantity', 12, 3)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->dropColumn(['item_type', 'expense_category', 'description']);
        });
    }
};
