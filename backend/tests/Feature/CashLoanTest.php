<?php

namespace Tests\Feature;

use App\Models\CashLoan;
use App\Models\CashMovement;
use App\Models\User;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Prestito dalla cassa: soldi presi per un po', con promemoria al socio finché non li restituisce. */
class CashLoanTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $luca;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'name' => 'Borrello']);
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca']);
        Sanctum::actingAs($this->admin);
        app(CashService::class)->createFromCents([
            'amount_cents' => 10000, 'direction' => 'entrata', 'type' => 'quota', 'category' => 'quote',
            'description' => 'Cassa di prova', 'movement_date' => now()->toDateString(),
        ], $this->admin);
    }

    private function balance(): int
    {
        return app(CashService::class)->balanceCents();
    }

    public function test_a_loan_takes_money_out_of_the_cash_and_shows_up_as_a_reminder_for_the_borrower(): void
    {
        $this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '20.00', 'note' => 'Resto'])->assertCreated();

        $this->assertSame(8000, $this->balance());
        $this->assertDatabaseHas('cash_movements', ['type' => 'prestito_cassa', 'direction' => 'uscita', 'amount_cents' => 2000, 'member_id' => $this->luca->id]);

        Sanctum::actingAs($this->luca);
        $this->getJson('/api/cash-loans/mine')->assertOk()->assertJsonCount(1)->assertJsonPath('0.amount_cents', 2000);

        // Gli altri non vedono i prestiti di Luca.
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/cash-loans/mine')->assertOk()->assertJsonCount(0);
    }

    public function test_repaying_brings_the_money_back_and_the_reminder_goes_away(): void
    {
        $loan = CashLoan::findOrFail($this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '20.00'])->assertCreated()->json('id'));

        $this->postJson("/api/cash-loans/{$loan->id}/repay", ['amount' => '5.00'])->assertOk()->assertJsonPath('remaining_cents', 1500);
        $this->assertSame(8500, $this->balance());

        $this->postJson("/api/cash-loans/{$loan->id}/repay", ['amount' => '15.01'])->assertUnprocessable();
        $this->postJson("/api/cash-loans/{$loan->id}/repay", ['amount' => '15.00'])->assertOk()->assertJsonPath('status', 'repaid');
        $this->assertSame(10000, $this->balance());

        Sanctum::actingAs($this->luca);
        $this->getJson('/api/cash-loans/mine')->assertOk()->assertJsonCount(0);
    }

    public function test_an_unpaid_loan_can_be_cancelled_but_not_after_a_repayment(): void
    {
        $first = CashLoan::findOrFail($this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '10.00'])->json('id'));
        $this->postJson("/api/cash-loans/{$first->id}/cancel", ['reason' => 'Errore'])->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertSame(10000, $this->balance());

        $second = CashLoan::findOrFail($this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '10.00'])->json('id'));
        $this->postJson("/api/cash-loans/{$second->id}/repay", ['amount' => '1.00'])->assertOk();
        $this->postJson("/api/cash-loans/{$second->id}/cancel", ['reason' => 'Troppo tardi'])->assertUnprocessable();
    }

    public function test_cannot_lend_more_than_the_cash_or_to_non_members_and_only_admin_can_lend(): void
    {
        $this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '100.01'])->assertUnprocessable();
        $guest = User::factory()->create(['role' => User::ROLE_GUEST]);
        $this->postJson('/api/cash-loans', ['member_id' => $guest->id, 'amount' => '5.00'])->assertUnprocessable();

        Sanctum::actingAs($this->luca);
        $this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '5.00'])->assertForbidden();
    }

    public function test_loan_movements_cannot_be_cancelled_from_the_cash_page(): void
    {
        $this->postJson('/api/cash-loans', ['member_id' => $this->luca->id, 'amount' => '10.00'])->assertCreated();
        $movement = CashMovement::where('type', 'prestito_cassa')->firstOrFail();

        $this->postJson("/api/cash/movements/{$movement->id}/reverse", ['reason' => 'Prova'])->assertUnprocessable();
        $this->assertSame(9000, $this->balance());
    }
}
