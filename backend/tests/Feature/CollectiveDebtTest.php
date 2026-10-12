<?php

namespace Tests\Feature;

use App\Models\MemberDebt;
use App\Models\User;
use App\Services\CashService;
use App\Services\DebtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CollectiveDebtTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'name' => 'Borrello']);
        Sanctum::actingAs($this->admin);
    }

    private function members(int $count): array
    {
        return collect(range(1, $count))->map(fn ($i) => User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => "Socio {$i}"]))->all();
    }

    private function openDebt(User $member): int
    {
        return (int) MemberDebt::where('user_id', $member->id)->where('status', 'open')->sum('remaining_amount_cents');
    }

    public function test_shortfall_is_split_among_chosen_members_and_lowers_the_balance(): void
    {
        [$a, $b, $c] = $this->members(3);
        $balanceBefore = app(CashService::class)->balanceCents();

        $this->postJson('/api/debts/collective', ['amount' => '5,90', 'member_ids' => [$a->id, $b->id, $c->id, $this->admin->id], 'reason' => 'Ammanco conteggio contanti'])
            ->assertUnprocessable(); // la virgola non è un numero valido per la validazione

        $this->postJson('/api/debts/collective', ['amount' => '5.90', 'member_ids' => [$a->id, $b->id, $c->id, $this->admin->id], 'reason' => 'Ammanco conteggio contanti'])
            ->assertCreated()
            ->assertJsonCount(4, 'debts');

        $shares = collect([$this->admin, $a, $b, $c])->map(fn ($m) => $this->openDebt($m))->sort()->values()->all();
        $this->assertSame([147, 147, 148, 148], $shares);
        $this->assertSame(590, array_sum($shares));
        $this->assertSame($balanceBefore - 590, app(CashService::class)->balanceCents());
        $this->assertDatabaseHas('cash_movements', ['type' => 'ammanco_cassa', 'direction' => 'uscita', 'amount_cents' => 590]);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'collective_debt_created']);
        $this->artisan('locale:check')->assertSuccessful();

        // Quando un socio paga la sua parte, i soldi rientrano in cassa.
        app(DebtService::class)->pay($a, $this->admin, $this->openDebt($a));
        $this->assertSame(0, $this->openDebt($a));
    }

    public function test_member_credit_is_used_for_the_share(): void
    {
        [$a, $b] = $this->members(2);
        app(DebtService::class)->pay($a, $this->admin, 100); // nessun debito: diventa credito

        $this->postJson('/api/debts/collective', ['amount' => '3.00', 'member_ids' => [$a->id, $b->id], 'reason' => 'Ammanco'])->assertCreated();

        $this->assertSame(50, $this->openDebt($a));
        $this->assertSame(150, $this->openDebt($b));
        $this->assertSame(0, app(DebtService::class)->walletCreditCents($a));
        $this->artisan('locale:check')->assertSuccessful();
    }

    public function test_guests_and_non_admins_are_rejected_and_shortfall_cannot_be_cancelled_from_cash(): void
    {
        [$a] = $this->members(1);
        $guest = User::factory()->create(['role' => User::ROLE_GUEST]);

        $this->postJson('/api/debts/collective', ['amount' => '2.00', 'member_ids' => [$a->id, $guest->id], 'reason' => 'Ammanco'])
            ->assertUnprocessable()->assertJsonValidationErrors('member_ids');
        $this->postJson('/api/debts/collective', ['amount' => '2.00', 'member_ids' => [$a->id], 'reason' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');

        $this->postJson('/api/debts/collective', ['amount' => '2.00', 'member_ids' => [$a->id], 'reason' => 'Ammanco'])->assertCreated();
        $movement = \App\Models\CashMovement::where('type', 'ammanco_cassa')->firstOrFail();
        $this->postJson("/api/cash/movements/{$movement->id}/reverse", ['reason' => 'Prova'])->assertUnprocessable();

        Sanctum::actingAs($a);
        $this->postJson('/api/debts/collective', ['amount' => '2.00', 'member_ids' => [$a->id], 'reason' => 'Ammanco'])->assertForbidden();
    }
}
