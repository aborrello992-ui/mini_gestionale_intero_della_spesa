<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restock_session_items', function (Blueprint $table) {
            // Es. "37 pezzi in 7 porzioni da 5, 2 in omaggio".
            $table->string('note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('restock_session_items', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
