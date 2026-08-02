<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LocaleManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $member;
    private Category $category;
    private Location $location;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        $this->category = Category::create(['name' => 'bevande']);
        $this->location = Location::create(['name' => 'frigo']);
        $this->product = Product::create([
            'category_id' => $this->category->id,
            'location_id' => $this->location->id,
            'name' => 'Acqua',
            'unit' => 'bottiglie',
            'current_quantity' => 5,
            'minimum_threshold' => 2,
        ]);
    }

    public function test_login_correct(): void
    {
        $user = User::factory()->create(['email' => 'login@locale.test', 'pin_hash' => '123']);

        $this->postJson('/api/login', ['member_id' => $user->id, 'pin' => '123'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->create(['is_active' => false, 'pin_hash' => '123']);

        $this->postJson('/api/login', ['member_id' => $user->id, 'pin' => '123'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('member_id');
    }

    public function test_member_cannot_access_admin_routes(): void
    {
        Sanctum::actingAs($this->member);

        $this->postJson('/api/products', $this->productPayload('Bibita'))->assertForbidden();
    }

    public function test_admin_can_create_product_and_low_stock_is_reported(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/products', $this->productPayload('Bibita'))
            ->assertCreated()
            ->assertJsonPath('data.name', 'Bibita');

        $this->getJson('/api/products/low-stock')->assertOk()->assertJsonFragment(['name' => 'Bibita']);
    }

    public function test_purchase_increments_stock_updates_price_and_creates_cash_outcome(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/purchases', [
            'purchased_at' => now()->toDateString(),
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 3, 'unit_cost' => '1.50'],
            ],
        ])->assertCreated();

        $this->assertSame('8.000', $this->product->fresh()->current_quantity);
        $this->assertSame(150, $this->product->fresh()->last_purchase_price_cents);
        $this->assertDatabaseHas('cash_movements', ['direction' => 'uscita', 'amount_cents' => 450]);
        $this->assertDatabaseHas('inventory_movements', ['type' => 'acquisto', 'quantity' => 3]);
    }

    public function test_valid_withdrawal_and_insufficient_withdrawal_block(): void
    {
        Sanctum::actingAs($this->member);

        $this->postJson('/api/inventory/withdraw', ['product_id' => $this->product->id, 'quantity' => 2])
            ->assertCreated();
        $this->assertSame('3.000', $this->product->fresh()->current_quantity);

        $this->postJson('/api/inventory/withdraw', ['product_id' => $this->product->id, 'quantity' => 99])
            ->assertUnprocessable();
        $this->assertSame('3.000', $this->product->fresh()->current_quantity);
    }

    public function test_negative_stock_adjustment_is_blocked(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/inventory/adjust', [
            'product_id' => $this->product->id,
            'quantity' => 99,
            'type' => 'correzione_negativa',
        ])->assertUnprocessable();
    }

    public function test_cash_balance_and_reverse_movement(): void
    {
        Sanctum::actingAs($this->admin);

        CashMovement::create([
            'user_id' => $this->admin->id,
            'amount_cents' => 1000,
            'direction' => 'entrata',
            'type' => 'versamento',
            'description' => 'Test',
            'movement_date' => now()->toDateString(),
        ]);

        $this->getJson('/api/cash/balance')->assertJsonPath('balance_cents', 1000);
        $movement = CashMovement::first();

        $this->postJson("/api/cash/movements/{$movement->id}/reverse")->assertCreated();
        $this->getJson('/api/cash/balance')->assertJsonPath('balance_cents', 0);
    }

    public function test_inventory_movement_can_be_reversed(): void
    {
        Sanctum::actingAs($this->member);

        $this->postJson('/api/inventory/withdraw', ['product_id' => $this->product->id, 'quantity' => 1]);
        Sanctum::actingAs($this->admin);
        $movement = InventoryMovement::where('type', 'prelievo')->first();

        $this->postJson("/api/inventory/movements/{$movement->id}/reverse")->assertCreated();
        $this->assertSame('5.000', $this->product->fresh()->current_quantity);
    }

    public function test_failed_purchase_transaction_leaves_no_partial_data(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/purchases', [
            'purchased_at' => now()->toDateString(),
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 2, 'unit_cost' => '1.00'],
                ['product_id' => 9999, 'quantity' => 2, 'unit_cost' => '1.00'],
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('purchases', 0);
        $this->assertSame('5.000', $this->product->fresh()->current_quantity);
    }

    private function productPayload(string $name): array
    {
        return [
            'category_id' => $this->category->id,
            'location_id' => $this->location->id,
            'name' => $name,
            'unit' => 'pezzi',
            'current_quantity' => 1,
            'minimum_threshold' => 2,
        ];
    }
}
