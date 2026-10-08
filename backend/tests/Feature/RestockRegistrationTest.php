<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\ShoppingListItem;
use App\Models\User;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class RestockRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $category = Category::create(['name' => 'Bibite']);
        $location = Location::create(['name' => 'Locale']);
        $this->product = Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Acqua',
            'unit' => 'pezzi',
            'current_quantity' => 0,
            'minimum_threshold' => 2,
            'selling_price_cents' => 50,
        ]);

        Sanctum::actingAs($this->admin);
    }

    private function payload(array $items, array $overrides = []): array
    {
        return [
            'total_amount' => '5.00',
            'purchased_at' => '2026-10-06',
            'purchased_time' => '18:30',
            'items' => $items,
            ...$overrides,
        ];
    }

    public function test_invalid_quantity_returns_clear_422_not_500(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 'abc', 'line_cost' => '5.00'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');

        $this->assertDatabaseCount('cash_movements', 0);
    }

    public function test_line_without_quantity_or_packages_is_rejected_with_product_name(): void
    {
        $response = $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 0, 'package_count' => 0, 'line_cost' => '5.00'],
        ]))->assertUnprocessable();

        $this->assertStringContainsString('Acqua', $response->json('errors')['items.0.quantity'][0]);
    }

    public function test_new_product_without_selling_price_is_rejected(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['name' => 'Patatine', 'unit' => 'pezzi', 'quantity' => 5, 'line_cost' => '5.00'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('items.0.selling_price');

        $this->assertDatabaseMissing('products', ['name' => 'Patatine']);
    }

    public function test_new_product_with_existing_name_is_rejected(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['name' => 'acqua', 'unit' => 'pezzi', 'quantity' => 5, 'line_cost' => '5.00', 'selling_price' => '1'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('items.0.name');
    }

    public function test_duplicate_product_in_same_session_is_rejected(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 6, 'line_cost' => '2.50'],
            ['product_id' => $this->product->id, 'quantity' => 6, 'line_cost' => '2.50'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('items.1.product_id');
    }

    public function test_already_purchased_shopping_list_item_is_rejected(): void
    {
        $item = ShoppingListItem::create([
            'product_id' => $this->product->id,
            'user_id' => $this->admin->id,
            'suggested_quantity' => 6,
            'priority' => 'media',
            'status' => 'acquistato',
        ]);

        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['shopping_list_item_id' => $item->id, 'product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '5.00'],
        ]))->assertUnprocessable()->assertJsonValidationErrors('items.0.shopping_list_item_id');
    }

    public function test_same_idempotency_key_twice_creates_single_movement(): void
    {
        $payload = $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '5.00'],
        ], ['idempotency_key' => 'f4c1c2a0-0000-4000-8000-000000000001']);

        $first = $this->postJson('/api/shopping-list/restock-sessions', $payload)->assertCreated();
        $second = $this->postJson('/api/shopping-list/restock-sessions', $payload)->assertOk();

        $this->assertSame($first->json('id'), $second->json('id'));
        $this->assertDatabaseCount('restock_sessions', 1);
        $this->assertDatabaseCount('cash_movements', 1);
        $this->assertSame(1, InventoryMovement::where('type', 'rifornimento')->count());
        $this->assertSame('12.000', $this->product->fresh()->current_quantity);
    }

    public function test_line_cost_is_stored_exactly_without_rounding_drift(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '5.00'],
        ]))->assertCreated();

        $this->assertDatabaseHas('restock_session_items', ['product_id' => $this->product->id, 'cost_cents' => 500, 'unit_cost_cents' => 42]);
        $this->assertDatabaseHas('restock_sessions', ['total_cents' => 500, 'difference_cents' => 0]);
        $this->assertSame(42, $this->product->fresh()->average_price_cents);
    }

    public function test_difference_requires_reason(): void
    {
        $items = [['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '4.80']];

        $this->postJson('/api/shopping-list/restock-sessions', $this->payload($items))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('difference_reason');

        $this->postJson('/api/shopping-list/restock-sessions', $this->payload($items, ['difference_reason' => 'sacchetto']))
            ->assertCreated();

        $this->assertDatabaseHas('restock_sessions', ['difference_cents' => 20, 'difference_reason' => 'sacchetto']);
    }

    public function test_zero_cost_is_treated_as_entered_cost(): void
    {
        $this->product->update(['current_quantity' => 2, 'average_price_cents' => 60, 'last_purchase_price_cents' => 60]);

        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 2, 'unit_cost' => '0'],
        ], ['total_amount' => '0.01', 'difference_reason' => 'arrotondamento']))->assertCreated();

        $product = $this->product->fresh();
        $this->assertSame(0, $product->last_purchase_price_cents);
        $this->assertSame(30, $product->average_price_cents);
        $this->assertDatabaseHas('restock_session_items', ['cost_cents' => 0, 'unit_cost_cents' => 0]);
    }

    public function test_failure_inside_transaction_rolls_back_everything_and_deletes_files(): void
    {
        Storage::fake('public');
        Product::creating(function (Product $product) {
            if ($product->name === 'Prodotto rotto') {
                throw new RuntimeException('Errore simulato durante la creazione.');
            }
        });

        $this->post('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 6, 'line_cost' => '2.50'],
            ['name' => 'Prodotto rotto', 'unit' => 'pezzi', 'quantity' => 2, 'line_cost' => '2.50', 'selling_price' => '2', 'image' => UploadedFile::fake()->image('p.jpg')],
        ], ['receipt_image' => UploadedFile::fake()->image('scontrino.jpg')]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Errore simulato durante la creazione.');

        $this->assertDatabaseCount('restock_sessions', 0);
        $this->assertDatabaseCount('cash_movements', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertSame('0.000', $this->product->fresh()->current_quantity);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_cash_balance_decreases_only_by_receipt_total_and_movements_are_linked(): void
    {
        CashMovement::create([
            'user_id' => $this->admin->id,
            'amount_cents' => 10000,
            'direction' => 'entrata',
            'type' => 'versamento',
            'description' => 'Fondo',
            'movement_date' => '2026-10-05',
        ]);

        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '3.00'],
            ['name' => 'Patatine', 'unit' => 'pezzi', 'quantity' => 4, 'line_cost' => '2.00', 'selling_price' => '1'],
        ]))->assertCreated();

        $this->assertSame(9500, app(CashService::class)->balanceCents());
        $cash = CashMovement::where('type', 'acquisto_prodotti')->sole();
        $this->assertSame(2, InventoryMovement::where('cash_movement_id', $cash->id)->count());
        $this->assertSame(1, RestockSession::count());
    }

    public function test_expense_line_counts_in_lines_total_but_not_in_stock(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '4.80'],
            ['item_type' => 'expense', 'expense_category' => 'sacchetti', 'description' => 'Sacchetto', 'line_cost' => '0.20'],
        ]))->assertCreated();

        $this->assertDatabaseHas('restock_sessions', ['total_cents' => 500, 'difference_cents' => 0]);
        $this->assertDatabaseHas('restock_session_items', ['item_type' => 'expense', 'expense_category' => 'sacchetti', 'cost_cents' => 20, 'product_id' => null, 'quantity' => null]);
        $this->assertSame('12.000', $this->product->fresh()->current_quantity);
        $this->assertSame(1, InventoryMovement::count());
        $this->assertSame(-500, app(CashService::class)->balanceCents());
    }

    public function test_expense_line_requires_category_and_amount(): void
    {
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            ['item_type' => 'expense', 'description' => 'Detersivo'],
        ]))->assertUnprocessable()->assertJsonValidationErrors(['items.0.expense_category', 'items.0.line_cost']);
    }

    public function test_receipt_photo_url_is_exposed_for_the_app(): void
    {
        Storage::fake('public');
        $id = $this->post('/api/shopping-list/restock-sessions', $this->payload([
            ['product_id' => $this->product->id, 'quantity' => 12, 'line_cost' => '5.00'],
        ], ['receipt_image' => UploadedFile::fake()->image('scontrino.jpg')]), ['Accept' => 'application/json'])->assertCreated()->json('id');

        $url = $this->getJson('/api/receipts')->assertOk()->json('data.0.receipt_image_url');
        $this->assertNotEmpty($url);
        $this->assertStringContainsString('receipts%2F', $url);
        $this->get($url)->assertOk();
        $this->getJson("/api/receipts/{$id}")->assertJsonPath('receipt_image_url', $url);
    }

    public function test_bag_split_into_portions_is_stocked_as_portions_with_note(): void
    {
        // Busta da 600 g a 1,59 EUR: 37 crocchette contate, 7 bustine da 5, 2 in omaggio.
        $this->postJson('/api/shopping-list/restock-sessions', $this->payload([
            [
                'name' => 'Crocchette di patate', 'category' => 'Surgelati', 'unit' => 'bustine', 'quantity' => 7,
                'line_cost' => '1.59', 'selling_price' => '0.50', 'note' => '37 pezzi in 7 porzioni da 5, 2 in omaggio',
            ],
        ], ['total_amount' => '1.59']))->assertCreated();

        $product = Product::where('name', 'Crocchette di patate')->sole();
        $this->assertSame('7.000', $product->current_quantity);
        $this->assertSame('bustine', $product->unit);
        $this->assertSame(23, $product->average_price_cents);
        $this->assertSame(50, $product->selling_price_cents);
        $this->assertDatabaseHas('categories', ['name' => 'Surgelati']);
        $this->assertDatabaseHas('restock_session_items', ['cost_cents' => 159, 'note' => '37 pezzi in 7 porzioni da 5, 2 in omaggio']);
        $this->assertDatabaseHas('restock_sessions', ['difference_cents' => 0]);
    }
}
