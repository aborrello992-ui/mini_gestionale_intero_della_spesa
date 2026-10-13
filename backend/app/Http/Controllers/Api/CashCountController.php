<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CashCountService;
use App\Services\CashService;
use Illuminate\Http\Request;
use RuntimeException;

class CashCountController extends Controller
{
    public function index(CashCountService $service)
    {
        return $service->overview();
    }

    public function store(Request $request, CashCountService $service, CashService $cashService)
    {
        $data = $request->validate([
            'counted' => ['required_without:breakdown', 'nullable', 'numeric', 'min:0'],
            'breakdown' => ['required_without:counted', 'nullable', 'array'],
            'breakdown.*' => ['integer', 'min:0', 'max:10000'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'counted.required_without' => 'Indica quanti contanti ci sono nel cassetto.',
        ]);

        try {
            $count = $service->record(
                $request->user(),
                isset($data['counted']) && $data['counted'] !== null ? $cashService->toCents($data['counted']) : null,
                $data['breakdown'] ?? null,
                $data['note'] ?? null,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['count' => $count, ...$service->overview()], 201);
    }
}
