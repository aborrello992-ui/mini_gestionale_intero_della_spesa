<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Soldi presi in prestito dalla cassa da un socio, da restituire (diversi dai copponi dei prodotti).
        Schema::create('cash_loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('created_by')->constrained('users');
            $table->unsignedInteger('amount_cents');
            $table->unsignedInteger('repaid_cents')->default(0);
            $table->string('status', 20)->default('open')->index(); // open | repaid | cancelled
            $table->string('note')->nullable();
            $table->timestamp('borrowed_at');
            $table->timestamp('repaid_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
        });

        Schema::table('cash_movements', function (Blueprint $table) {
            $table->foreignId('cash_loan_id')->nullable()->after('debt_payment_id')->constrained('cash_loans');
        });
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cash_loan_id');
        });
        Schema::dropIfExists('cash_loans');
    }
};
