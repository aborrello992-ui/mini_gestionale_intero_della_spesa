<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use App\Services\CashService;
use App\Services\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashCorrectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Product $crocchette;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->crocchette = Product::create([
            'category_id' => Category::create(['name' => 'Surgelati'])->id,
            'location_id' => Location::create(['name' => 'Freezer'])->id,
            'name' => 'Crocchette di patate',
            'unit' => 'bustine',
            'current_quantity' => 0,
            'minimum_threshold' => 1,
            'selling_price_cents' => 50,
        ]);
        Sanctum::actingAs($this->admin);
    }

    private function balance(): int
    {
        return app(CashService::class)->balanceCents();
    }

    private function spesa(string $total, float $quantity): CashMovement
    {
        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => $total,
            'purchased_at' => now()->toDateString(),
            'purchased_time' => '18:30',
            'items' => [['product_id' => $this->crocchette->id, 'quantity' => $quantity, 'line_cost' => $total]],
        ])->assertCreated();

        return CashMovement::query()->latest('id')->firstOrFail();
    }

    private function manual(string $direction, string $amount): CashMovement
    {
        $this->postJson('/api/management/movements', [
            'type' => $direction === 'uscita' ? 'spesa_generica' : 'correzione',
            'direction' => $direction,
            'amount' => $amount,
            'member_id' => $direction === 'uscita' ? null : $this->admin->id,
            'reason' => 'Correzione crocchette',
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i'),
        ])->assertCreated();

        return CashMovement::query()->latest('id')->firstOrFail();
    }

    private function cancel(CashMovement $movement, bool $removeStock = false)
    {
        return $this->postJson("/api/cash/movements/{$movement->id}/reverse", ['reason' => 'Registrato per sbaglio', 'remove_stock' => $removeStock]);
    }

    public function test_crocchette_case_cancelling_the_three_wrong_movements_restores_the_cash(): void
    {
        $this->spesa('45.52', 10);              // spesa vera, crocchette comprese
        $double = $this->spesa('1.59', 1);       // crocchette aggiunte di nuovo: uscita doppia
        $wrongOut = $this->manual('uscita', '1.59');
        $wrongIn = $this->manual('entrata', '3.18');
        $this->assertSame(-4552, $this->balance());

        // Si annullano i tre movimenti sbagliati; le crocchette restano in magazzino.
        $this->cancel($double)->assertCreated();
        $this->cancel($wrongOut)->assertCreated();
        $this->cancel($wrongIn)->assertCreated();

        $this->assertSame(-4552, $this->balance());
        $this->assertSame('11.000', $this->crocchette->fresh()->current_quantity);
        $this->assertSame(3, CashMovement::where('status', 'reversed')->count());
        $this->assertSame(3, CashMovement::where('type', 'annullamento')->count());
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'cash_movement_cancelled']);
        $this->artisan('locale:check')->assertSuccessful();

        // Lo scontrino da 1,59 resta in elenco come annullato e non conta più nei totali degli scontrini.
        $receipts = collect($this->getJson('/api/receipts')->assertOk()->json('data'));
        $this->assertSame('cancelled', $receipts->firstWhere('total_cents', 159)['status']);
        $this->getJson('/api/management/summary')->assertOk()
            ->assertJsonPath('receipts.count', 1)
            ->assertJsonPath('receipts.total_cents', 4552);

        // Lo stesso movimento non si annulla due volte.
        $this->cancel($wrongIn)->assertUnprocessable()->assertJsonPath('message', 'Movimento già annullato.');
    }

    public function test_cancelling_a_whole_spesa_can_also_remove_the_stock(): void
    {
        $spesa = $this->spesa('1.59', 1);

        $this->cancel($spesa, true)->assertCreated();

        $this->assertSame(0, $this->balance());
        $this->assertSame('0.000', $this->crocchette->fresh()->current_quantity);
        $this->assertDatabaseHas('inventory_movements', ['product_id' => $this->crocchette->id, 'type' => 'annullamento']);
        $this->assertDatabaseHas('restock_sessions', ['total_cents' => 159, 'status' => 'cancelled']);
    }

    public function test_list_says_what_can_be_cancelled_and_what_stock_was_loaded(): void
    {
        $this->spesa('1.59', 2);
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        app(WithdrawalService::class)->take($this->crocchette, $member, $this->admin, 1, 'paid');

        $rows = collect($this->getJson('/api/cash/movements')->assertOk()->json('data'));
        $spesa = $rows->firstWhere('type', 'acquisto_prodotti');
        $paid = $rows->firstWhere('type', 'prodotto_pagato');

        $this->assertNull($spesa['cancel_block_reason']);
        $this->assertSame([['product' => 'Crocchette di patate', 'unit' => 'bustine', 'quantity' => 2]], $spesa['stock_loads']);
        $this->assertStringContainsString('Riassegna prelievi', $paid['cancel_block_reason']);
        $this->cancel(CashMovement::find($paid['id']))->assertUnprocessable();

        // Il saldo di apertura della cassa non si annulla mai.
        $opening = CashMovement::create([
            'user_id' => $this->admin->id, 'amount_cents' => 2130, 'direction' => 'entrata', 'type' => 'saldo_iniziale',
            'category' => 'apertura', 'description' => 'Saldo iniziale', 'movement_date' => now()->toDateString(),
        ]);
        $this->cancel($opening)->assertUnprocessable()->assertJsonPath('message', 'È il saldo di apertura della cassa: non si annulla.');
    }

    public function test_reason_is_required_and_members_cannot_cancel(): void
    {
        $movement = $this->manual('uscita', '1.59');
        $this->postJson("/api/cash/movements/{$movement->id}/reverse", [])->assertUnprocessable()->assertJsonValidationErrors('reason');

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));
        $this->cancel($movement)->assertForbidden();
    }

    public function test_stock_can_be_added_or_removed_without_touching_the_cash(): void
    {
        $this->postJson('/api/inventory/adjust', ['product_id' => $this->crocchette->id, 'quantity' => 7, 'type' => 'correzione_positiva'])
            ->assertUnprocessable()->assertJsonValidationErrors('note');

        $this->postJson('/api/inventory/adjust', ['product_id' => $this->crocchette->id, 'quantity' => 7, 'type' => 'correzione_positiva', 'note' => 'Già pagate nella spesa da 45,52'])
            ->assertCreated();
        $this->postJson('/api/inventory/adjust', ['product_id' => $this->crocchette->id, 'quantity' => 2, 'type' => 'correzione_negativa', 'note' => 'Bustine rotte'])
            ->assertCreated();

        $this->assertSame('5.000', $this->crocchette->fresh()->current_quantity);
        $this->assertSame(0, $this->balance());
        $this->assertDatabaseCount('cash_movements', 0);
        $this->assertDatabaseHas('inventory_movements', ['type' => 'correzione_positiva', 'note' => 'Già pagate nella spesa da 45,52']);
    }
}
