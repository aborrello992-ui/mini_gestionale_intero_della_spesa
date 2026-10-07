<?php

namespace App\Services;

use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\ShoppingListItem;
use App\Models\User;
use App\Support\RestockLine;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class RestockSessionService
{
    public function __construct(private CashService $cashService) {}

    /**
     * Registra una spesa. Restituisce [sessione, creata]: creata = false quando la stessa
     * idempotency_key era gia stata usata (doppio invio) e non e stato scritto nulla.
     *
     * @return array{0: RestockSession, 1: bool}
     */
    public function register(array $data, User $admin): array
    {
        $key = $data['idempotency_key'] ?? null;
        if ($key && ($existing = $this->findByKey($key))) {
            return [$existing, false];
        }

        $storedFiles = [];

        try {
            if (($data['receipt_image'] ?? null) instanceof UploadedFile) {
                $data['receipt_image_path'] = $this->storeFile($data['receipt_image'], 'receipts', $storedFiles);
            }

            $session = DB::transaction(function () use ($data, $admin, &$storedFiles) {
                return $this->persist($data, $admin, $storedFiles);
            });

            return [$session, true];
        } catch (UniqueConstraintViolationException $exception) {
            $this->deleteFiles($storedFiles);
            if ($key && ($existing = $this->findByKey($key))) {
                return [$existing, false];
            }

            throw $exception;
        } catch (Throwable $exception) {
            $this->deleteFiles($storedFiles);

            throw $exception;
        }
    }

    private function persist(array $data, User $admin, array &$storedFiles): RestockSession
    {
        $totalCents = $this->cashService->toCents($data['total_amount']);
        $linesTotalCents = collect($data['items'])->sum(fn (array $item) => RestockLine::lineCostCents($item) ?? 0);

        $session = RestockSession::create([
            'user_id' => $admin->id,
            'idempotency_key' => $data['idempotency_key'] ?? null,
            'total_cents' => $totalCents,
            'difference_cents' => $totalCents - $linesTotalCents,
            'difference_reason' => $data['difference_reason'] ?? null,
            'purchased_at' => $data['purchased_at'],
            'purchased_time' => $data['purchased_time'],
            'receipt_image_path' => $data['receipt_image_path'] ?? null,
            'note' => $data['note'] ?? null,
        ]);

        // La cassa scala una sola volta il totale ufficiale dello scontrino.
        $cashMovement = $this->cashService->createFromCents([
            'amount_cents' => $totalCents,
            'direction' => 'uscita',
            'type' => 'acquisto_prodotti',
            'category' => 'lista_spesa',
            'description' => 'Spesa prodotti #'.$session->id,
            'movement_date' => $data['purchased_at'],
            'movement_time' => $data['purchased_time'],
            'note' => $data['note'] ?? null,
        ], $admin);

        foreach ($data['items'] as $item) {
            if (RestockLine::isExpense($item)) {
                // Voce non magazzino: conta nel totale righe ma non tocca stock, costi o prezzi.
                $session->items()->create([
                    'item_type' => 'expense',
                    'expense_category' => $item['expense_category'],
                    'description' => $item['description'] ?? null,
                    'cost_cents' => RestockLine::lineCostCents($item),
                ]);

                continue;
            }

            $this->persistProductLine($session, $cashMovement->id, $item, $admin, $storedFiles);
        }

        return $session->load('items');
    }

    private function persistProductLine(RestockSession $session, int $cashMovementId, array $item, User $admin, array &$storedFiles): void
    {
        $product = ! empty($item['product_id'])
            ? Product::query()->whereKey($item['product_id'])->lockForUpdate()->firstOrFail()
            : $this->createProductFromItem($item, $storedFiles);

        $quantity = RestockLine::quantity($item);
        if ($quantity <= 0) {
            throw new RuntimeException("La quantità acquistata di «{$product->name}» deve essere maggiore di zero.");
        }

        $previous = (float) $product->current_quantity;
        $resulting = $previous + $quantity;
        $lineCostCents = RestockLine::lineCostCents($item);
        $unitCostCents = RestockLine::unitCostCents($item);
        $previousAverage = (int) ($product->average_price_cents ?? 0);
        $newAverage = $lineCostCents !== null
            ? $this->weightedAverageCost($previous, $previousAverage, $quantity, $lineCostCents)
            : $previousAverage;

        $updates = ['current_quantity' => $resulting];
        if (! blank($item['selling_price'] ?? null)) {
            $updates['selling_price_cents'] = $this->cashService->toCents($item['selling_price']);
        }
        if ($unitCostCents !== null) {
            $updates['last_purchase_price_cents'] = $unitCostCents;
            $updates['average_price_cents'] = $newAverage;
        }
        $product->update($updates);

        $sessionItem = $session->items()->create([
            'product_id' => $product->id,
            'shopping_list_item_id' => $item['shopping_list_item_id'] ?? null,
            'package_count' => $item['package_count'] ?? null,
            'pieces_per_package' => $item['pieces_per_package'] ?? null,
            'quantity' => $quantity,
            'selling_price_cents' => $updates['selling_price_cents'] ?? null,
            'cost_cents' => $lineCostCents,
            'unit_cost_cents' => $unitCostCents,
            'previous_average_cost_cents' => $previousAverage,
            'new_average_cost_cents' => $newAverage,
        ]);

        InventoryMovement::create([
            'product_id' => $product->id,
            'user_id' => $admin->id,
            'cash_movement_id' => $cashMovementId,
            'type' => 'rifornimento',
            'quantity' => $quantity,
            'previous_quantity' => $previous,
            'resulting_quantity' => $resulting,
            'note' => 'Sessione spesa #'.$session->id.' riga #'.$sessionItem->id,
        ]);

        if (! empty($item['shopping_list_item_id'])) {
            $updated = ShoppingListItem::query()
                ->whereKey($item['shopping_list_item_id'])
                ->whereNotIn('status', ['acquistato', 'annullato'])
                ->update([
                    'status' => 'acquistato',
                    'purchased_quantity' => $quantity,
                    'completed_at' => now(),
                    'restock_session_id' => $session->id,
                ]);

            if ($updated === 0) {
                throw new RuntimeException("La voce della lista per «{$product->name}» è già stata acquistata o annullata.");
            }
        }
    }

    private function createProductFromItem(array $item, array &$storedFiles): Product
    {
        $category = Category::firstOrCreate(['name' => blank($item['category'] ?? null) ? 'Altro' : $item['category']]);
        $location = Location::firstOrCreate(['name' => blank($item['location'] ?? null) ? 'Locale' : $item['location']]);
        $image = $item['image'] ?? null;

        return Product::create([
            'name' => $item['name'],
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit' => $item['unit'],
            'current_quantity' => 0,
            'minimum_threshold' => $item['minimum_threshold'] ?? 1,
            'stock_reference_quantity' => max(RestockLine::quantity($item), 10),
            'selling_price_cents' => $this->cashService->toCents($item['selling_price'] ?? 0),
            'image_path' => $image instanceof UploadedFile ? $this->storeFile($image, 'products', $storedFiles) : null,
            'image_alt' => $item['name'],
        ]);
    }

    private function weightedAverageCost(float $previousQuantity, int $previousAverageCents, float $newQuantity, int $lineCostCents): int
    {
        if ($previousQuantity <= 0 || $previousAverageCents <= 0) {
            return (int) round($lineCostCents / $newQuantity);
        }

        return (int) round((($previousQuantity * $previousAverageCents) + $lineCostCents) / ($previousQuantity + $newQuantity));
    }

    private function findByKey(string $key): ?RestockSession
    {
        return RestockSession::query()->where('idempotency_key', $key)->first()?->load('items');
    }

    private function storeFile(UploadedFile $file, string $directory, array &$storedFiles): string
    {
        $path = $file->store($directory, 'public');
        if (! is_string($path) || $path === '') {
            throw new RuntimeException("Impossibile salvare l'immagine. Riprova.");
        }
        $storedFiles[] = $path;

        return $path;
    }

    private function deleteFiles(array $paths): void
    {
        if ($paths !== []) {
            Storage::disk('public')->delete($paths);
        }
    }
}
