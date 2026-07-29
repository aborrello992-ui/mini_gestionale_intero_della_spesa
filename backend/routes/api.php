<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CashController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ShoppingListController;
use App\Http\Controllers\Api\UserController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/dashboard', DashboardController::class);
    Route::get('/products/low-stock', [InventoryController::class, 'lowStock']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/locations', [LocationController::class, 'index']);
    Route::post('/inventory/withdraw', [InventoryController::class, 'withdraw']);
    Route::get('/inventory/movements', [InventoryController::class, 'movements']);
    Route::get('/cash/balance', [CashController::class, 'balance']);
    Route::get('/cash/movements', [CashController::class, 'index']);
    Route::get('/shopping-list', [ShoppingListController::class, 'index']);
    Route::post('/shopping-list', [ShoppingListController::class, 'store']);
    Route::put('/shopping-list/{item}', [ShoppingListController::class, 'update']);
    Route::delete('/shopping-list/{item}', [ShoppingListController::class, 'destroy']);
    Route::get('/history', HistoryController::class);

    Route::middleware('admin')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
        Route::post('/products/{product}/restore', [ProductController::class, 'restore']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{category}', [CategoryController::class, 'update']);
        Route::post('/locations', [LocationController::class, 'store']);
        Route::put('/locations/{location}', [LocationController::class, 'update']);
        Route::get('/purchases', [PurchaseController::class, 'index']);
        Route::post('/purchases', [PurchaseController::class, 'store']);
        Route::get('/purchases/{purchase}', [PurchaseController::class, 'show']);
        Route::post('/inventory/adjust', [InventoryController::class, 'adjust']);
        Route::post('/inventory/movements/{movement}/reverse', [InventoryController::class, 'reverse']);
        Route::post('/cash/movements', [CashController::class, 'store']);
        Route::post('/cash/movements/{movement}/reverse', [CashController::class, 'reverse']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
    });
});
