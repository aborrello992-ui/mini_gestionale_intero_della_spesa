<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restock_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->unsignedInteger('total_cents');
            $table->date('purchased_at');
            $table->time('purchased_time');
            $table->string('status')->default('completed');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('restock_session_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restock_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('shopping_list_item_id')->nullable()->constrained();
            $table->decimal('quantity', 12, 3);
            $table->unsignedInteger('selling_price_cents')->nullable();
            $table->unsignedInteger('cost_cents')->nullable();
            $table->timestamps();
        });

        Schema::table('shopping_list_items', function (Blueprint $table) {
            $table->unsignedInteger('estimated_price_cents')->nullable()->after('suggested_quantity');
            $table->foreignId('restock_session_id')->nullable()->after('completed_at')->constrained();
        });
    }

    public function down(): void
    {
        Schema::table('shopping_list_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('restock_session_id');
            $table->dropColumn('estimated_price_cents');
        });

        Schema::dropIfExists('restock_session_items');
        Schema::dropIfExists('restock_sessions');
    }
};
