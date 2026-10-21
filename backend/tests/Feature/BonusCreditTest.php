<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\User;
use App\Services\CashService;
use App\Services\DebtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Credito bonus: aumenta il portafoglio di un socio senza muovere la cassa. */
class BonusCreditTest extends TestCase
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
    }

    public function test_bonus_credit_raises_the_wallet_without_touching_cash(): void
    {
        $cashBefore = app(CashService::class)->balanceCents();

        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '10.00', 'reason' => 'Ha montato gli scaffali'])
            ->assertCreated()
            ->assertJsonPath('wallet_credit_cents', 1000);

        $this->assertSame(1000, app(DebtService::class)->walletCreditCents($this->luca));
        $this->assertSame($cashBefore, app(CashService::class)->balanceCents());
        $this->assertDatabaseHas('cash_movements', ['type' => 'credito_bonus', 'member_id' => $this->luca->id, 'affects_current_balance' => false]);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'bonus_credit_added']);
    }

    public function test_bonus_credit_pays_open_debts_and_cash_stays_the_same(): void
    {
        app(DebtService::class)->addManualDebt($this->luca, $this->admin, 400, 'Prodotti presi');
        $cashBefore = app(CashService::class)->balanceCents();

        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '10.00', 'reason' => 'Lavoro per il locale'])
            ->assertCreated()
            ->assertJsonPath('applied_to_debts_cents', 400)
            ->assertJsonPath('wallet_credit_cents', 600);

        $this->assertSame(0, (int) MemberDebt::where('user_id', $this->luca->id)->where('status', 'open')->sum('remaining_amount_cents'));
        $this->assertSame($cashBefore, app(CashService::class)->balanceCents());
    }

    public function test_only_admin_can_give_bonus_credit_and_a_reason_is_required(): void
    {
        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '5.00'])->assertUnprocessable()->assertJsonValidationErrors('reason');

        Sanctum::actingAs($this->luca);
        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '5.00', 'reason' => 'Me lo do da solo'])->assertForbidden();
    }

    public function test_unused_bonus_credit_can_be_revoked_but_not_after_it_was_spent(): void
    {
        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '5.00', 'reason' => 'Errore'])->assertCreated();
        $bonus = CashMovement::where('type', 'credito_bonus')->firstOrFail();
        $cashBefore = app(CashService::class)->balanceCents();

        $this->postJson("/api/debts/bonus-credits/{$bonus->id}/revoke", ['reason' => 'Dato per sbaglio'])->assertOk();
        $this->assertSame(0, app(DebtService::class)->walletCreditCents($this->luca));
        $this->assertSame($cashBefore, app(CashService::class)->balanceCents());

        // Credito già speso su un coppone: non si può più annullare.
        $this->postJson("/api/debts/{$this->luca->id}/bonus-credit", ['amount' => '5.00', 'reason' => 'Lavoro'])->assertCreated();
        $second = CashMovement::where('type', 'credito_bonus')->where('status', 'active')->firstOrFail();
        app(DebtService::class)->addManualDebt($this->luca, $this->admin, 300, 'Prodotti presi');
        app(DebtService::class)->applyWalletCreditToOpenDebts($this->luca, $this->admin);

        $this->postJson("/api/debts/bonus-credits/{$second->id}/revoke", ['reason' => 'Troppo tardi'])->assertUnprocessable();
    }
}
