<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_debts', function (Blueprint $table) {
            $table->string('restoration_key')->nullable()->unique()->after('id');
        });

        Schema::table('cash_movements', function (Blueprint $table) {
            $table->string('restoration_key')->nullable()->unique()->after('id');
            $table->dateTime('occurred_at')->nullable()->after('movement_time');
            $table->boolean('occurred_at_is_approximate')->default(false)->after('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropColumn(['restoration_key', 'occurred_at', 'occurred_at_is_approximate']);
        });

        Schema::table('member_debts', function (Blueprint $table) {
            $table->dropColumn('restoration_key');
        });
    }
};
