<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Combo: prodotti venduti insieme a un prezzo scelto dall'admin.
        Schema::create('combos', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->unsignedInteger('price_cents');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('combo_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('combo_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->decimal('quantity', 12, 3);
            $table->timestamps();
            $table->unique(['combo_id', 'product_id']);
        });

        // Vendita raggruppata: combo e/o spesa divisa fra piu soci ("mangia con un amico").
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users');
            $table->string('kind', 20);
            $table->unsignedInteger('total_cents');
            $table->unsignedSmallInteger('participants_count');
            $table->text('note')->nullable();
            $table->timestamp('archived_at')->nullable()->index();
            $table->string('archived_reason')->nullable();
            $table->timestamps();
        });

        Schema::table('withdrawals', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable()->constrained();
            $table->foreignId('combo_id')->nullable()->constrained();
        });
    }

    public function down(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('combo_id');
            $table->dropConstrainedForeignId('sale_id');
        });
        Schema::dropIfExists('sales');
        Schema::dropIfExists('combo_items');
        Schema::dropIfExists('combos');
    }
};
