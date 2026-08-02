<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RestockSession;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function index(Request $request)
    {
        return RestockSession::query()
            ->with('user:id,name')
            ->withCount('items')
            ->withSum('items as total_quantity', 'quantity')
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('purchased_at', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('purchased_at', '<=', $date))
            ->when($request->photo === 'with', fn ($q) => $q->whereNotNull('receipt_image_path')->where('receipt_image_path', '!=', ''))
            ->when($request->photo === 'without', fn ($q) => $q->where(fn ($sub) => $sub->whereNull('receipt_image_path')->orWhere('receipt_image_path', '')))
            ->latest('purchased_at')
            ->paginate($request->integer('per_page', 20));
    }

    public function show(RestockSession $receipt)
    {
        return $receipt->load([
            'user:id,name',
            'items.product:id,name,image_path,image_alt,selling_price_cents,current_quantity,average_price_cents,last_purchase_price_cents',
            'items.shoppingListItem:id,product_id,status,suggested_quantity,purchased_quantity',
        ]);
    }
}
