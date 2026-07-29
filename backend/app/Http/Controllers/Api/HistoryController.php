<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\InventoryMovement;
use Illuminate\Http\Request;

class HistoryController extends Controller
{
    public function __invoke(Request $request)
    {
        if ($request->type === 'cassa') {
            return CashMovement::with('user:id,name')
                ->when($request->direction, fn ($q, $direction) => $q->where('direction', $direction))
                ->latest()
                ->paginate($request->integer('per_page', 20));
        }

        return InventoryMovement::with('product:id,name,category_id', 'product.category:id,name', 'user:id,name')
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->when($request->movement_type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('created_at', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('created_at', '<=', $date))
            ->latest()
            ->paginate($request->integer('per_page', 20));
    }
}
