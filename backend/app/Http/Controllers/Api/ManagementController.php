<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ManagementMovementService;
use Illuminate\Http\Request;
use RuntimeException;

class ManagementController extends Controller
{
    public function store(Request $request, ManagementMovementService $service)
    {
        $data = $request->validate([
            'type' => ['required', 'in:acquisto_prodotti,spesa_locale,accredito,quota,rimborso,pagamento_debito,correzione,altro'],
            'direction' => ['required', 'in:entrata,uscita'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'movement_date' => ['required', 'date'],
            'movement_time' => ['required', 'date_format:H:i'],
            'member_id' => ['nullable', 'exists:users,id'],
            'product_id' => ['nullable', 'exists:products,id'],
            'quantity_purchased' => ['nullable', 'numeric', 'min:0.001'],
            'new_selling_price' => ['nullable', 'numeric', 'min:0'],
            'new_purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string'],
        ]);

        try {
            return response()->json($service->create($data, $request->user()), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
