<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prodotti con lo stesso choice_group sono alternative: la combo ne prevede uno solo, scelto all'acquisto.
        Schema::table('combo_items', function (Blueprint $table) {
            $table->unsignedTinyInteger('choice_group')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('combo_items', function (Blueprint $table) {
            $table->dropColumn('choice_group');
        });
    }
};
