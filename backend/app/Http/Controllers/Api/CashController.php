<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Services\CashCorrectionService;
use App\Services\CashService;
use Illuminate\Http\Request;
use RuntimeException;

class CashController extends Controller
{
    public function balance(CashService $service)
    {
        return $service->counters();
    }

    public function index(Request $request, CashCorrectionService $corrections)
    {
        $page = CashMovement::with('user:id,name', 'member:id,name', 'product:id,name')
            ->when($request->direction, fn ($q, $direction) => $q->where('direction', $direction))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->category, fn ($q, $category) => $q->where('category', $category))
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('movement_date', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('movement_date', '<=', $date))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        // Per il pulsante "Annulla": se si può annullare e quale merce era stata caricata insieme.
        $page->getCollection()->each(function (CashMovement $movement) use ($corrections) {
            $movement->setAttribute('cancel_block_reason', $corrections->blockReason($movement));
            $movement->setAttribute('stock_loads', $corrections->stockLoads($movement)->map(fn ($load) => [
                'product' => $load->product?->name,
                'unit' => $load->product?->unit,
                'quantity' => (float) $load->quantity,
            ])->values());
        });

        return $page;
    }

    public function store(Request $request, CashService $service)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'direction' => ['required', 'in:entrata,uscita'],
            'type' => ['required', 'in:versamento,acquisto_prodotti,altra_spesa,rimborso,correzione,accredito,quota,spesa_locale,altro'],
            'category' => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
            'movement_date' => ['required', 'date'],
            'movement_time' => ['nullable', 'date_format:H:i'],
            'member_id' => ['nullable', 'exists:users,id'],
            'product_id' => ['nullable', 'exists:products,id'],
            'note' => ['nullable', 'string'],
        ]);

        return response()->json($service->create($data, $request->user()), 201);
    }

    /** Annulla un'entrata o un'uscita registrata per sbaglio (admin), con movimento di compensazione. */
    public function reverse(CashMovement $movement, Request $request, CashCorrectionService $corrections)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:255'],
            'remove_stock' => ['sometimes', 'boolean'],
        ], [
            'reason.required' => 'Indica il motivo dell\'annullamento.',
            'reason.min' => 'Il motivo deve avere almeno 3 caratteri.',
        ]);

        try {
            return response()->json($corrections->cancel($movement, $request->user(), $data['reason'], $request->boolean('remove_stock')), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
