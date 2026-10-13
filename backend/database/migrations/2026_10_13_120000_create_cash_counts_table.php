<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Conteggi dei contanti realmente presenti nel cassetto, con il saldo dell'app in quel momento. */
    public function up(): void
    {
        Schema::create('cash_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->integer('counted_cents');
            $table->integer('app_balance_cents');
            $table->json('breakdown')->nullable();
            $table->string('note')->nullable();
            $table->timestamp('counted_at');
            $table->timestamps();
            $table->index('counted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_counts');
    }
};
