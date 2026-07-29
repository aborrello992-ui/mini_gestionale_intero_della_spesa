<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pin_hash')->nullable()->after('password');
            $table->string('avatar_path')->nullable()->after('is_active');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('selling_price_cents')->default(0)->after('minimum_threshold');
            $table->decimal('stock_reference_quantity', 12, 3)->nullable()->after('minimum_threshold');
            $table->string('image_path')->nullable()->after('description');
            $table->string('image_alt')->nullable()->after('image_path');
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('alt_text')->nullable();
            $table->boolean('is_primary')->default(true);
            $table->timestamps();
        });

        Schema::create('shared_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('name');
            $table->string('token_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('withdrawals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('created_by')->constrained('users');
            $table->decimal('quantity', 12, 3);
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('total_amount_cents');
            $table->string('payment_status');
            $table->timestamp('withdrawn_at');
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('member_debts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('withdrawal_id')->constrained();
            $table->foreignId('user_id')->constrained();
            $table->unsignedInteger('original_amount_cents');
            $table->unsignedInteger('paid_amount_cents')->default(0);
            $table->unsignedInteger('remaining_amount_cents');
            $table->string('status')->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('debt_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('admin_user_id')->constrained('users');
            $table->unsignedInteger('amount_cents');
            $table->timestamp('paid_at');
            $table->string('type')->default('payment');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('debt_payment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debt_payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_debt_id')->constrained();
            $table->unsignedInteger('amount_cents');
            $table->timestamps();
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->foreignId('withdrawal_id')->nullable()->after('purchase_id')->constrained();
            $table->foreignId('cash_movement_id')->nullable()->after('withdrawal_id')->constrained();
            $table->unsignedInteger('unit_price_cents')->nullable()->after('resulting_quantity');
            $table->unsignedInteger('total_amount_cents')->nullable()->after('unit_price_cents');
        });

        Schema::table('cash_movements', function (Blueprint $table) {
            $table->foreignId('member_id')->nullable()->after('user_id')->constrained('users');
            $table->foreignId('product_id')->nullable()->after('member_id')->constrained();
            $table->foreignId('withdrawal_id')->nullable()->after('purchase_id')->constrained();
            $table->unsignedBigInteger('debt_payment_id')->nullable()->after('withdrawal_id');
            $table->time('movement_time')->nullable()->after('movement_date');
            $table->integer('resulting_balance_cents')->nullable()->after('amount_cents');
        });
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('member_id');
            $table->dropConstrainedForeignId('product_id');
            $table->dropConstrainedForeignId('withdrawal_id');
            $table->dropColumn(['debt_payment_id', 'movement_time', 'resulting_balance_cents']);
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('withdrawal_id');
            $table->dropConstrainedForeignId('cash_movement_id');
            $table->dropColumn(['unit_price_cents', 'total_amount_cents']);
        });

        Schema::dropIfExists('debt_payment_items');
        Schema::dropIfExists('debt_payments');
        Schema::dropIfExists('member_debts');
        Schema::dropIfExists('withdrawals');
        Schema::dropIfExists('shared_devices');
        Schema::dropIfExists('product_images');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['selling_price_cents', 'stock_reference_quantity', 'image_path', 'image_alt']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['pin_hash', 'avatar_path']);
        });
    }
};
