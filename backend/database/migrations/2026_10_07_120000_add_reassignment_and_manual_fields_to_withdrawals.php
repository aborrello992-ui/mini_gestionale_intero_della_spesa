<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->foreignId('original_user_id')->nullable()->constrained('users');
            $table->timestamp('reassigned_at')->nullable();
            $table->foreignId('reassigned_by')->nullable()->constrained('users');
            $table->string('reassign_reason')->nullable();
            $table->boolean('is_manual')->default(false);
            $table->boolean('affects_stock')->default(true);
        });

        // Registro degli azzeramenti conti (usato anche per vietare prelievi manuali prima del taglio).
        Schema::create('account_resets', function (Blueprint $table) {
            $table->id();
            $table->date('cutoff_date')->unique();
            $table->integer('opening_cash_cents');
            $table->foreignId('opening_cash_movement_id')->nullable()->constrained('cash_movements');
            $table->string('backup_path')->nullable();
            $table->json('summary')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_resets');

        Schema::table('withdrawals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('original_user_id');
            $table->dropConstrainedForeignId('reassigned_by');
            $table->dropColumn(['reassigned_at', 'reassign_reason', 'is_manual', 'affects_stock']);
        });
    }
};
