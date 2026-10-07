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
            return CashMovement::with('user:id,name', 'member:id,name', 'product:id,name')
                ->when($request->search, fn ($q, $search) => $q->where(fn ($sub) => $sub
                    ->where('description', 'like', "%{$search}%")
                    ->orWhereHas('member', fn ($m) => $m->where('name', 'like', "%{$search}%"))))
                ->when($request->direction, fn ($q, $direction) => $q->where('direction', $direction))
                ->when($request->movement_type, fn ($q, $type) => $q->where('type', $type))
                ->when($request->date_from, fn ($q, $date) => $q->whereDate('movement_date', '>=', $date))
                ->when($request->date_to, fn ($q, $date) => $q->whereDate('movement_date', '<=', $date))
                ->latest()
                ->paginate(min(max($request->integer('per_page', 20), 1), 100));
        }

        return InventoryMovement::with('product:id,name,category_id', 'product.category:id,name', 'user:id,name', 'withdrawal.actor:id,name')
            ->when($request->search, fn ($q, $search) => $q->where(fn ($sub) => $sub
                ->whereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"))
                ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"))))
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->when($request->movement_type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('created_at', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('created_at', '<=', $date))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }
}
