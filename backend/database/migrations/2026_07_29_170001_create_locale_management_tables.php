<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained();
            $table->foreignId('location_id')->constrained();
            $table->string('name');
            $table->string('normalized_name')->unique();
            $table->text('description')->nullable();
            $table->string('unit')->default('pezzi');
            $table->decimal('current_quantity', 12, 3)->default(0);
            $table->decimal('minimum_threshold', 12, 3)->default(1);
            $table->unsignedInteger('average_price_cents')->default(0);
            $table->unsignedInteger('last_purchase_price_cents')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->date('purchased_at');
            $table->string('supplier')->nullable();
            $table->string('receipt_number')->nullable();
            $table->text('note')->nullable();
            $table->unsignedInteger('total_cents')->default(0);
            $table->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->decimal('quantity', 12, 3);
            $table->unsignedInteger('unit_cost_cents');
            $table->unsignedInteger('line_total_cents');
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('purchase_id')->nullable()->constrained();
            $table->foreignId('reverses_movement_id')->nullable()->constrained('inventory_movements');
            $table->string('type');
            $table->decimal('quantity', 12, 3);
            $table->decimal('previous_quantity', 12, 3);
            $table->decimal('resulting_quantity', 12, 3);
            $table->text('note')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('purchase_id')->nullable()->constrained();
            $table->foreignId('reverses_movement_id')->nullable()->constrained('cash_movements');
            $table->unsignedInteger('amount_cents');
            $table->string('direction');
            $table->string('type');
            $table->string('category')->nullable();
            $table->string('description');
            $table->date('movement_date');
            $table->text('note')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('shopping_list_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->decimal('suggested_quantity', 12, 3)->default(1);
            $table->string('priority')->default('media');
            $table->text('note')->nullable();
            $table->string('status')->default('da_acquistare');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopping_list_items');
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('products');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('categories');
    }
};
