<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\CashService;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke(CashService $cashService)
    {
        return [
            'cash_balance_cents' => $cashService->balanceCents(),
            'active_products_count' => Product::active()->count(),
            'low_stock_count' => Product::active()->whereColumn('current_quantity', '<=', 'minimum_threshold')->count(),
            'out_of_stock_count' => Product::active()->where('current_quantity', 0)->count(),
            'latest_inventory_movements' => InventoryMovement::with('product:id,name', 'user:id,name')->latest()->limit(8)->get(),
            'latest_cash_movements' => CashMovement::with('user:id,name')->latest()->limit(8)->get(),
            'top_withdrawn_products' => InventoryMovement::query()
                ->select('product_id', DB::raw('SUM(quantity) as total_quantity'))
                ->with('product:id,name,unit')
                ->where('type', 'prelievo')
                ->where('status', 'active')
                ->groupBy('product_id')
                ->orderByDesc('total_quantity')
                ->limit(5)
                ->get(),
        ];
    }
}
