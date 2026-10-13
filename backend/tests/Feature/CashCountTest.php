<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashCountTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($this->admin);
    }

    private function move(string $direction, int $cents): void
    {
        app(CashService::class)->createFromCents([
            'amount_cents' => $cents, 'direction' => $direction, 'type' => $direction === 'entrata' ? 'prodotto_pagato' : 'acquisto_prodotti',
            'description' => 'Prova', 'movement_date' => now()->toDateString(),
        ], $this->admin);
    }

    public function test_expected_cash_follows_the_movements_after_the_last_count(): void
    {
        // Saldo dell'app diverso dai contanti (spesa pagata di tasca): -45,52 €.
        $this->move('uscita', 4552);

        $this->postJson('/api/cash/counts', ['counted' => '53.60'])->assertCreated()
            ->assertJsonPath('expected_cents', 5360)
            ->assertJsonPath('latest.drift_cents', null);

        // Spesa Eurospin pagata col cassetto e un pagamento di 0,50 €.
        $this->move('uscita', 4522);
        $this->move('entrata', 50);
        $this->getJson('/api/cash/counts')->assertOk()->assertJsonPath('expected_cents', 888);

        // Conteggio giusto: niente differenza.
        $this->postJson('/api/cash/counts', ['counted' => '8.88'])->assertCreated()->assertJsonPath('latest.drift_cents', 0);

        // Conteggio con 1,20 € in meno: ammanco.
        $this->move('entrata', 300);
        $this->postJson('/api/cash/counts', ['counted' => '10.68', 'note' => 'Sera'])->assertCreated()
            ->assertJsonPath('latest.expected_cents', 1188)
            ->assertJsonPath('latest.drift_cents', -120)
            ->assertJsonCount(3, 'counts');
    }

    public function test_count_by_pieces_computes_the_total(): void
    {
        $this->postJson('/api/cash/counts', ['breakdown' => ['5000' => 1, '200' => 1, '50' => 3, '10' => 1]])->assertCreated()
            ->assertJsonPath('count.counted_cents', 5360)
            ->assertJsonPath('count.breakdown.5000', 1);

        $this->postJson('/api/cash/counts', ['breakdown' => ['300' => 1]])->assertUnprocessable();
        $this->postJson('/api/cash/counts', [])->assertUnprocessable();
    }

    public function test_members_can_see_but_not_count(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));
        $this->getJson('/api/cash/counts')->assertOk();
        $this->postJson('/api/cash/counts', ['counted' => '10'])->assertForbidden();
    }
}
