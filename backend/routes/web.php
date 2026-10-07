<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Compatibilita con i vecchi link alle foto (/storage/receipts/..., /storage/products/...).
Route::get('/storage/{path}', [\App\Http\Controllers\Api\MediaController::class, 'legacy'])->where('path', '.*');
