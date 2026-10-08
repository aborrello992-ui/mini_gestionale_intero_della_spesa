<?php

namespace Tests\Feature;

use App\Models\Category;
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

class WithdrawalCorrectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $luca;

    private Product $birra;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca']);
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

    private function balance(): int
    {
        return app(CashService::class)->balanceCents();
    }

    private function openDebt(): int
    {
        return (int) MemberDebt::where('user_id', $this->luca->id)->where('status', 'open')->sum('remaining_amount_cents');
    }

    private function assertLocaleCheckPasses(): void
    {
        $this->artisan('locale:check')->assertSuccessful();
    }

    public function test_paid_corrected_to_coppone_reverses_cash_and_creates_debt(): void
    {
        $withdrawal = $this->take('paid');
        $this->assertSame(300, $this->balance());

        $this->postJson("/api/withdrawals/{$withdrawal->id}/payment", ['payment_status' => 'coppone', 'reason' => 'Ha premuto pagato per sbaglio'])
            ->assertOk()->assertJsonPath('payment_status', 'coppone');

        $this->assertSame(0, $this->balance());
        $this->assertSame(300, $this->openDebt());
        $this->assertSame('8.000', $this->birra->fresh()->current_quantity);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'withdrawal_payment_corrected']);
        $this->assertLocaleCheckPasses();
    }

    public function test_coppone_corrected_to_paid_closes_debt_and_cashes_only_the_missing_part(): void
    {
        $withdrawal = $this->take('coppone');
        app(DebtService::class)->pay($this->luca, $this->admin, 100);
        $this->assertSame(100, $this->balance());

        $this->postJson("/api/withdrawals/{$withdrawal->id}/payment", ['payment_status' => 'paid', 'reason' => 'Aveva pagato in contanti'])
            ->assertOk()->assertJsonPath('payment_status', 'paid');

        $this->assertSame(300, $this->balance());
        $this->assertSame(0, $this->openDebt());
        $this->assertSame('settled', MemberDebt::where('withdrawal_id', $withdrawal->id)->value('status'));
        $this->assertLocaleCheckPasses();
    }

    public function test_cancel_paid_withdrawal_returns_stock_and_reverses_cash(): void
    {
        $withdrawal = $this->take('paid');

        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => 'Toccato per sbaglio'])
            ->assertOk()->assertJsonPath('status', 'cancelled');

        $this->assertSame('10.000', $this->birra->fresh()->current_quantity);
        $this->assertSame(0, $this->balance());
        $this->assertDatabaseHas('inventory_movements', ['withdrawal_id' => $withdrawal->id, 'type' => 'annullamento']);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'withdrawal_cancelled']);
        $this->assertLocaleCheckPasses();
    }

    public function test_cancel_partially_paid_coppone_closes_debt_and_returns_credit(): void
    {
        $withdrawal = $this->take('coppone');
        app(DebtService::class)->pay($this->luca, $this->admin, 100);

        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => 'Prodotto sbagliato'])->assertOk();

        $this->assertSame('10.000', $this->birra->fresh()->current_quantity);
        $this->assertSame(0, $this->openDebt());
        $this->assertSame('cancelled', MemberDebt::where('withdrawal_id', $withdrawal->id)->value('status'));
        $this->assertSame(100, app(DebtService::class)->walletCreditCents($this->luca));
        $this->assertSame(100, $this->balance());

        // Il credito restituito paga subito il prossimo coppone.
        $this->take('coppone', 1);
        $this->assertSame(50, $this->openDebt());
        $this->assertLocaleCheckPasses();
    }

    public function test_cancelled_withdrawal_cannot_be_changed_again_and_reason_is_required(): void
    {
        $withdrawal = $this->take('paid');

        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => ''])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/withdrawals/{$withdrawal->id}/payment", ['payment_status' => 'paid', 'reason' => 'Niente'])
            ->assertUnprocessable()->assertJsonPath('message', 'Il prelievo è già segnato così.');

        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => 'Sbaglio'])->assertOk();
        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => 'Ancora'])->assertUnprocessable();
        $this->postJson("/api/withdrawals/{$withdrawal->id}/payment", ['payment_status' => 'coppone', 'reason' => 'Ancora'])->assertUnprocessable();
        $this->assertSame('10.000', $this->birra->fresh()->current_quantity);
    }

    public function test_members_cannot_correct_or_cancel(): void
    {
        $withdrawal = $this->take('paid');
        Sanctum::actingAs($this->luca);

        $this->postJson("/api/withdrawals/{$withdrawal->id}/cancel", ['reason' => 'Voglio annullare'])->assertForbidden();
        $this->postJson("/api/withdrawals/{$withdrawal->id}/payment", ['payment_status' => 'coppone', 'reason' => 'Voglio cambiare'])->assertForbidden();
    }
}
