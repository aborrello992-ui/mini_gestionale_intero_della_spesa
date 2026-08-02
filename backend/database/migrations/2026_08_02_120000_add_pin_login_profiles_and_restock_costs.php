<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('last_name')->nullable()->after('name');
            $table->boolean('can_consume')->default(true)->after('is_active');
        });

        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users');
            $table->foreignId('target_user_id')->nullable()->constrained('users');
            $table->string('action');
            $table->json('changes')->nullable();
            $table->timestamps();
        });

        Schema::table('restock_sessions', function (Blueprint $table) {
            $table->string('receipt_image_path')->nullable()->after('purchased_time');
            $table->integer('difference_cents')->default(0)->after('total_cents');
            $table->string('difference_reason')->nullable()->after('difference_cents');
        });

        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->decimal('package_count', 12, 3)->nullable()->after('shopping_list_item_id');
            $table->decimal('pieces_per_package', 12, 3)->nullable()->after('package_count');
            $table->unsignedInteger('unit_cost_cents')->nullable()->after('cost_cents');
            $table->unsignedInteger('previous_average_cost_cents')->nullable()->after('unit_cost_cents');
            $table->unsignedInteger('new_average_cost_cents')->nullable()->after('previous_average_cost_cents');
        });

        Schema::table('shopping_list_items', function (Blueprint $table) {
            $table->decimal('purchased_quantity', 12, 3)->nullable()->after('suggested_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('shopping_list_items', function (Blueprint $table) {
            $table->dropColumn('purchased_quantity');
        });

        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->dropColumn(['package_count', 'pieces_per_package', 'unit_cost_cents', 'previous_average_cost_cents', 'new_average_cost_cents']);
        });

        Schema::table('restock_sessions', function (Blueprint $table) {
            $table->dropColumn(['receipt_image_path', 'difference_cents', 'difference_reason']);
        });

        Schema::dropIfExists('admin_audit_logs');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['last_name', 'can_consume']);
        });
    }
};
