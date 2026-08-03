<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CardWithdrawalAndDebtTest extends TestCase
{
    use RefreshDatabase;

    private User $device;
    private User $admin;
    private User $member;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->device = User::factory()->create(['role' => User::ROLE_DEVICE, 'pin_hash' => null]);
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'pin_hash' => null]);
        $this->member = User::factory()->create(['role' => User::ROLE_MEMBER, 'pin_hash' => '125']);
        $category = Category::create(['name' => 'bevande']);
        $location = Location::create(['name' => 'frigo']);
        $this->product = Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Cola',
            'unit' => 'bottiglie',
            'current_quantity' => 10,
            'minimum_threshold' => 2,
            'stock_reference_quantity' => 20,
            'selling_price_cents' => 150,
        ]);
    }

    public function test_pin_must_be_three_digits_and_invalid_pin_is_rejected(): void
    {
        Sanctum::actingAs($this->device);

        $this->postJson('/api/withdrawals', $this->payload(['pin' => '12']))->assertUnprocessable();
        $this->postJson('/api/withdrawals', $this->payload(['pin' => '999']))->assertUnprocessable();
        $this->assertSame('10.000', $this->product->fresh()->current_quantity);
    }

    public function test_paid_card_withdrawal_increments_cash_and_does_not_create_debt(): void
    {
        Sanctum::actingAs($this->device);

        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'paid', 'quantity' => 2]))
            ->assertCreated()
            ->assertJsonPath('payment_status', 'paid');

        $this->assertSame('8.000', $this->product->fresh()->current_quantity);
        $this->assertDatabaseHas('cash_movements', ['direction' => 'entrata', 'amount_cents' => 300, 'type' => 'prodotto_pagato']);
        $this->assertDatabaseCount('member_debts', 0);
    }

    public function test_coppone_card_withdrawal_creates_debt_without_changing_cash(): void
    {
        Sanctum::actingAs($this->device);

        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'coppone', 'quantity' => 2]))->assertCreated();

        $this->assertDatabaseHas('member_debts', ['user_id' => $this->member->id, 'remaining_amount_cents' => 300, 'status' => 'open']);
        $this->getJson('/api/cash/balance')
            ->assertJsonPath('balance_cents', 0)
            ->assertJsonPath('open_coppone_cents', 300)
            ->assertJsonPath('inventory_potential_cents', 1200);
    }

    public function test_partial_and_full_debt_payment_increment_cash(): void
    {
        Sanctum::actingAs($this->device);
        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'coppone', 'quantity' => 2]))->assertCreated();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '1.00'])->assertCreated();
        $this->assertDatabaseHas('member_debts', ['paid_amount_cents' => 100, 'remaining_amount_cents' => 200, 'status' => 'open']);

        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '2.00'])->assertCreated();
        $this->assertDatabaseHas('member_debts', ['paid_amount_cents' => 300, 'remaining_amount_cents' => 0, 'status' => 'settled']);
        $this->getJson('/api/cash/balance')->assertJsonPath('balance_cents', 300);
    }

    public function test_invalid_debt_payment_amounts_are_rejected_and_member_cannot_pay(): void
    {
        Sanctum::actingAs($this->device);
        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'coppone', 'quantity' => 2]))->assertCreated();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '0'])->assertUnprocessable();
        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '99.00'])->assertUnprocessable();
        $this->assertDatabaseHas('member_debts', ['paid_amount_cents' => 0, 'remaining_amount_cents' => 300, 'status' => 'open']);
        $this->assertDatabaseCount('cash_movements', 0);

        Sanctum::actingAs($this->member);
        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '1.00'])->assertForbidden();
    }

    public function test_debt_payment_cash_movement_is_linked_to_member(): void
    {
        Sanctum::actingAs($this->device);
        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'coppone', 'quantity' => 2]))->assertCreated();

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/debts/{$this->member->id}/payments", ['amount' => '3.00'])->assertCreated();

        $this->assertDatabaseHas('cash_movements', [
            'direction' => 'entrata',
            'amount_cents' => 300,
            'type' => 'pagamento_debito',
            'member_id' => $this->member->id,
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_debts_page_only_lists_members_with_open_debts(): void
    {
        Sanctum::actingAs($this->device);
        $this->postJson('/api/withdrawals', $this->payload(['payment_status' => 'coppone']))->assertCreated();

        $this->getJson('/api/debts')
            ->assertOk()
            ->assertJsonFragment(['name' => $this->member->name]);
    }

    public function test_admin_can_register_generic_expense_and_income(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/management/movements', [
            'type' => 'accredito',
            'direction' => 'entrata',
            'member_id' => $this->member->id,
            'amount' => '10.00',
            'description' => 'Accredito demo',
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i'),
        ])->assertCreated();

        $this->postJson('/api/management/movements', [
            'type' => 'spesa_generica',
            'direction' => 'uscita',
            'amount' => '4.00',
            'description' => 'Spesa demo',
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i'),
        ])->assertCreated();

        $this->getJson('/api/cash/balance')->assertJsonPath('balance_cents', 600);
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'product_id' => $this->product->id,
            'member_id' => $this->member->id,
            'pin' => '125',
            'quantity' => 1,
            'payment_status' => 'paid',
        ], $override);
    }
}
