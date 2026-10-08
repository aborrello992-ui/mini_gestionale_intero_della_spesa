<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            // Acquisti degli ospiti: socio garante e verifica del pagamento da parte di un admin.
            $table->foreignId('sponsor_id')->nullable()->constrained('users');
            $table->timestamp('payment_verified_at')->nullable();
            $table->foreignId('payment_verified_by')->nullable()->constrained('users');
        });
    }

    public function down(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_verified_by');
            $table->dropConstrainedForeignId('sponsor_id');
            $table->dropColumn('payment_verified_at');
        });
    }
};
