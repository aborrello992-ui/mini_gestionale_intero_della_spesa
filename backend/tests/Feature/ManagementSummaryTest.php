<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use App\Services\CashService;
use App\Services\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManagementSummaryTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'name' => 'Admin']);
        $this->member = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Socio']);
        Sanctum::actingAs($this->admin);
    }

    private function product(string $name, float $quantity, float $threshold = 2): Product
    {
        return Product::create([
            'category_id' => Category::firstOrCreate(['name' => 'Bibite'])->id,
            'location_id' => Location::firstOrCreate(['name' => 'Locale'])->id,
            'name' => $name,
            'unit' => 'pezzi',
            'current_quantity' => $quantity,
            'minimum_threshold' => $threshold,
            'selling_price_cents' => 100,
            'average_price_cents' => 60,
        ]);
    }

    public function test_dashboard_uses_real_withdrawal_types_and_disjoint_stock_counters(): void
    {
        $birra = $this->product('Birra', 10);
        $this->product('Acqua', 0);
        $this->product('Coca', 1);
        $service = app(WithdrawalService::class);
        $service->take($birra, $this->member, $this->admin, 3, 'paid');
        $service->take($birra, $this->member, $this->admin, 2, 'coppone');

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('top_withdrawn_products.0.product.name', 'Birra')
            ->assertJsonPath('top_withdrawn_products.0.total_quantity', 5)
            ->assertJsonPath('out_of_stock_count', 1)
            ->assertJsonPath('low_stock_count', 1);
    }

    public function test_balance_is_correct_with_reversals(): void
    {
        $cash = app(CashService::class);
        $in = $cash->createFromCents(['amount_cents' => 5000, 'direction' => 'entrata', 'type' => 'quota', 'description' => 'Quota', 'movement_date' => '2026-10-06'], $this->admin);
        $out = $cash->createFromCents(['amount_cents' => 1200, 'direction' => 'uscita', 'type' => 'spesa_generica', 'description' => 'Spesa', 'movement_date' => '2026-10-06'], $this->admin);
        $cash->reverse($out->fresh(), $this->admin);
        $this->assertSame(5000, $cash->balanceCents());

        $cash->reverse($in->fresh(), $this->admin);
        $this->assertSame(0, $cash->balanceCents());
        $this->artisan('locale:check')->assertSuccessful();
    }

    public function test_reversing_non_balance_movement_does_not_change_balance(): void
    {
        $cash = app(CashService::class);
        $cash->createFromCents(['amount_cents' => 1000, 'direction' => 'entrata', 'type' => 'quota', 'description' => 'Quota', 'movement_date' => '2026-10-06'], $this->admin);
        $usage = $cash->createFromCents(['amount_cents' => 300, 'direction' => 'uscita', 'type' => 'utilizzo_accredito', 'description' => 'Uso', 'movement_date' => '2026-10-06', 'affects_current_balance' => false], $this->admin);

        $cash->reverse($usage->fresh(), $this->admin);

        $this->assertSame(1000, $cash->balanceCents());
    }

    public function test_summary_endpoint_returns_server_side_counters(): void
    {
        $birra = $this->product('Birra', 10);
        app(WithdrawalService::class)->take($birra, $this->member, $this->admin, 2, 'paid');
        app(WithdrawalService::class)->take($birra, $this->member, $this->admin, 1, 'coppone');
        CashMovement::create(['user_id' => $this->admin->id, 'amount_cents' => 2000, 'direction' => 'entrata', 'type' => 'quota', 'description' => 'Quota', 'movement_date' => now()->toDateString()]);

        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '5.00',
            'purchased_at' => now()->toDateString(),
            'purchased_time' => '10:00',
            'items' => [
                ['product_id' => $birra->id, 'quantity' => 6, 'line_cost' => '4.50'],
                ['item_type' => 'expense', 'expense_category' => 'sacchetti', 'line_cost' => '0.50'],
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/management/summary?from='.now()->subDay()->toDateString().'&to='.now()->toDateString())->assertOk();

        $response->assertJsonPath('balance_cents', 200 + 2000 - 500)
            ->assertJsonPath('cash.income_cents', 2200)
            ->assertJsonPath('cash.outcome_cents', 500)
            ->assertJsonPath('open_coppone_cents', 100)
            ->assertJsonPath('receipts.count', 1)
            ->assertJsonPath('receipts.lines', 2)
            ->assertJsonPath('receipts.products_cents', 450)
            ->assertJsonPath('receipts.expenses_cents', 50)
            ->assertJsonPath('receipts.expenses_by_category.sacchetti', 50)
            ->assertJsonPath('receipts.difference_cents', 0);

        $members = collect($response->json('members'))->keyBy('name');
        $this->assertSame(100, $members['Socio']['open_coppone_cents']);
        $this->assertGreaterThan(0, $response->json('inventory.value_at_cost_cents'));
        $this->assertSame(1300, $response->json('inventory.value_at_price_cents'));

        Sanctum::actingAs($this->member);
        $this->getJson('/api/management/summary')->assertForbidden();
    }

    public function test_withdrawal_inventory_movement_cannot_be_reversed_directly(): void
    {
        $birra = $this->product('Birra', 10);
        app(WithdrawalService::class)->take($birra, $this->member, $this->admin, 2, 'paid');
        $movement = InventoryMovement::where('type', 'prelievo_pagato')->sole();

        $this->postJson("/api/inventory/movements/{$movement->id}/reverse")->assertUnprocessable();
        $this->assertSame('8.000', $birra->fresh()->current_quantity);
    }

    public function test_admin_cannot_lock_themselves_out(): void
    {
        $this->putJson("/api/users/{$this->admin->id}", ['name' => 'Admin', 'role' => 'member', 'is_active' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->putJson("/api/users/{$this->admin->id}", ['name' => 'Admin', 'role' => 'admin', 'is_active' => false])
            ->assertUnprocessable();

        $this->putJson("/api/users/{$this->member->id}", ['name' => 'Socio 2', 'role' => 'member', 'is_active' => true])
            ->assertOk()->assertJsonPath('name', 'Socio 2');
    }

    public function test_history_search_is_server_side(): void
    {
        $birra = $this->product('Birra', 10);
        $this->product('Acqua', 10);
        app(WithdrawalService::class)->take($birra, $this->member, $this->admin, 1, 'paid');

        $this->getJson('/api/history?search=birr')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/history?search=acqua')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/history?type=cassa&search=birra')->assertOk()->assertJsonPath('total', 1);
    }
}
