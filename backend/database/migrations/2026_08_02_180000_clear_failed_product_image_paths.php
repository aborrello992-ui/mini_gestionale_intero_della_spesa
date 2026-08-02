<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')
            ->where('image_path', '0')
            ->update(['image_path' => null]);
    }

    public function down(): void
    {
        // Intentionally left blank: restoring a failed upload marker is not useful.
    }
};
