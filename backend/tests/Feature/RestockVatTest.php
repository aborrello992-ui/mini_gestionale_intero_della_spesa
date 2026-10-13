<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RestockVatTest extends TestCase
{
    use RefreshDatabase;

    private function product(string $name): Product
    {
        return Product::create([
            'category_id' => Category::firstOrCreate(['name' => 'Bibite'])->id,
            'location_id' => Location::firstOrCreate(['name' => 'Locale'])->id,
            'name' => $name,
            'unit' => 'pezzi',
            'current_quantity' => 0,
            'minimum_threshold' => 1,
            'selling_price_cents' => 50,
        ]);
    }

    public function test_vat_rates_are_saved_as_a_check_without_changing_costs(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        $crocchette = $this->product('Crocchette');
        $cola = $this->product('Cola');

        // Righe dello scontrino Eurospin: importi IVA inclusa, come stampati nella colonna EURO.
        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '6.54',
            'vat_amount' => '1.04',
            'purchased_at' => '2026-10-12',
            'purchased_time' => '20:23',
            'items' => [
                ['product_id' => $crocchette->id, 'quantity' => 1, 'line_cost' => '1.59', 'vat_rate' => 10],
                ['product_id' => $cola->id, 'quantity' => 12, 'line_cost' => '3.96', 'vat_rate' => 22],
                ['item_type' => 'expense', 'expense_category' => 'pulizia', 'description' => 'Detersivo', 'line_cost' => '0.99', 'vat_rate' => 22],
            ],
        ])->assertCreated();

        $session = RestockSession::query()->latest('id')->firstOrFail();
        $this->assertSame(104, (int) $session->vat_cents);
        $this->assertDatabaseHas('restock_session_items', ['item_type' => 'expense', 'vat_rate' => 22, 'cost_cents' => 99]);
        $this->assertSame(10, (int) $crocchette->fresh()->vat_rate);
        $this->assertSame(22, (int) $cola->fresh()->vat_rate);
        $this->assertDatabaseHas('restock_session_items', ['product_id' => $cola->id, 'vat_rate' => 22, 'cost_cents' => 396]);
        // Il costo resta quello dello scontrino (IVA inclusa): 3,96 € / 12 = 33 cent.
        $this->assertSame(33, (int) $cola->fresh()->average_price_cents);
        $this->assertDatabaseHas('cash_movements', ['type' => 'acquisto_prodotti', 'amount_cents' => 654]);
    }

    public function test_unknown_vat_rate_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        $cola = $this->product('Cola');

        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '3.96', 'purchased_at' => '2026-10-12', 'purchased_time' => '20:23',
            'items' => [['product_id' => $cola->id, 'quantity' => 12, 'line_cost' => '3.96', 'vat_rate' => 7]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.vat_rate');
    }
}
