<?php

namespace Tests\Feature;

use App\Models\AccountReset;
use App\Models\CashMovement;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\CashService;
use App\Services\DebtService;
use App\Services\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WithdrawalReassignTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $luca;

    private User $sara;

    private Product $birra;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca']);
        $this->sara = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Sara']);
        $this->birra = Product::create([
            'category_id' => Category::create(['name' => 'Bibite'])->id,
            'location_id' => Location::create(['name' => 'Locale'])->id,
            'name' => 'Birra',
            'unit' => 'bottiglie',
            'current_quantity' => 10,
            'minimum_threshold' => 1,
            'selling_price_cents' => 150,
        ]);
        Sanctum::actingAs($this->admin);
    }

    private function take(string $payment, float $quantity = 2): Withdrawal
    {
        return app(WithdrawalService::class)->take($this->birra, $this->luca, $this->admin, $quantity, $payment);
    }

    private function openDebt(User $member): int
    {
        return (int) MemberDebt::where('user_id', $member->id)->where('status', 'open')->sum('remaining_amount_cents');
    }

    public function test_paid_withdrawal_reassign_moves_member_without_changing_cash(): void
    {
        $withdrawal = $this->take('paid');
        $balance = app(CashService::class)->balanceCents();

        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Preso da Sara'])
            ->assertOk()
            ->assertJsonPath('member.name', 'Sara')
            ->assertJsonPath('original_user_id', $this->luca->id);

        $this->assertSame($balance, app(CashService::class)->balanceCents());
        $this->assertSame($this->sara->id, CashMovement::where('withdrawal_id', $withdrawal->id)->value('member_id'));
        $this->assertSame($this->sara->id, InventoryMovement::where('withdrawal_id', $withdrawal->id)->value('user_id'));
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'withdrawal_reassigned', 'target_user_id' => $this->sara->id]);
    }

    public function test_unpaid_coppone_debt_moves_to_new_member(): void
    {
        $withdrawal = $this->take('coppone');

        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Errore socio'])->assertOk();

        $this->assertSame(0, $this->openDebt($this->luca));
        $this->assertSame(300, $this->openDebt($this->sara));
        $this->assertSame(1, MemberDebt::count());
        $this->assertSame(0, app(CashService::class)->balanceCents());
    }

    public function test_partially_paid_coppone_returns_credit_and_creates_new_debt(): void
    {
        $withdrawal = $this->take('coppone');
        app(DebtService::class)->pay($this->luca, $this->admin, 100);
        $balance = app(CashService::class)->balanceCents();
        $this->assertSame(100, $balance);

        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Errore socio'])->assertOk();

        $debtService = app(DebtService::class);
        $this->assertSame(0, $this->openDebt($this->luca));
        $this->assertSame(100, $debtService->walletCreditCents($this->luca->fresh()));
        $this->assertSame(300, $this->openDebt($this->sara));
        $this->assertSame($balance, app(CashService::class)->balanceCents());
        $this->assertDatabaseHas('member_debts', ['withdrawal_id' => $withdrawal->id, 'user_id' => $this->luca->id, 'status' => 'reassigned', 'paid_amount_cents' => 100]);
    }

    public function test_returned_credit_pays_other_open_debts_of_old_member(): void
    {
        $first = $this->take('coppone');
        app(DebtService::class)->pay($this->luca, $this->admin, 300);
        $this->take('coppone', 1);
        $this->assertSame(150, $this->openDebt($this->luca));

        $this->postJson("/api/withdrawals/{$first->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Era di Sara'])->assertOk();

        $this->assertSame(0, $this->openDebt($this->luca));
        $this->assertSame(150, app(DebtService::class)->walletCreditCents($this->luca->fresh()));
        $this->assertSame(300, $this->openDebt($this->sara));
    }

    public function test_reassign_requires_reason_and_rejects_cancelled_withdrawal(): void
    {
        $withdrawal = $this->take('paid');
        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id])->assertUnprocessable()->assertJsonValidationErrors('reason');

        $withdrawal->update(['status' => 'annullato']);
        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Prova'])->assertUnprocessable();

        Sanctum::actingAs($this->luca);
        $this->postJson("/api/withdrawals/{$withdrawal->id}/reassign", ['member_id' => $this->sara->id, 'reason' => 'Prova'])->assertForbidden();
    }

    public function test_manual_withdrawal_updates_stock_and_debt(): void
    {
        $this->postJson('/api/withdrawals/manual', [
            'member_id' => $this->luca->id,
            'product_id' => $this->birra->id,
            'quantity' => 2,
            'payment_status' => 'coppone',
            'withdrawn_date' => now()->subDay()->toDateString(),
            'withdrawn_time' => '21:30',
            'notes' => 'Dimenticato',
        ])->assertCreated()->assertJsonPath('is_manual', true);

        $this->assertSame('8.000', $this->birra->fresh()->current_quantity);
        $this->assertSame(300, $this->openDebt($this->luca));
    }

    public function test_manual_withdrawal_can_leave_stock_untouched(): void
    {
        $this->postJson('/api/withdrawals/manual', [
            'member_id' => $this->luca->id,
            'product_id' => $this->birra->id,
            'quantity' => 1,
            'payment_status' => 'paid',
            'withdrawn_date' => now()->toDateString(),
            'withdrawn_time' => '10:00',
            'affects_stock' => false,
        ])->assertCreated();

        $this->assertSame('10.000', $this->birra->fresh()->current_quantity);
        $this->assertSame(150, app(CashService::class)->balanceCents());
    }

    public function test_manual_withdrawal_before_reset_cutoff_is_rejected(): void
    {
        AccountReset::create(['cutoff_date' => '2026-10-05', 'opening_cash_cents' => 0]);

        $this->postJson('/api/withdrawals/manual', [
            'member_id' => $this->luca->id,
            'product_id' => $this->birra->id,
            'quantity' => 1,
            'payment_status' => 'coppone',
            'withdrawn_date' => '2026-10-04',
            'withdrawn_time' => '23:00',
        ])->assertUnprocessable()->assertJsonPath('message', "Non puoi inserire prelievi prima dell'azzeramento dei conti del 05/10/2026.");

        $this->assertSame(0, Withdrawal::count());
    }
}
