<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Correzione Pagato/Coppone e annullamento di un prelievo da parte di un admin (con movimenti di correzione). */
    public function up(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancel_reason')->nullable();
            $table->timestamp('payment_corrected_at')->nullable();
            $table->foreignId('payment_corrected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_correction_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('withdrawals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropConstrainedForeignId('payment_corrected_by');
            $table->dropColumn(['cancelled_at', 'cancel_reason', 'payment_corrected_at', 'payment_correction_reason']);
        });
    }
};
