<?php

namespace Tests\Feature;

use App\Models\AccountReset;
use App\Models\CashMovement;
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
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountResetTest extends TestCase
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
            'current_quantity' => 20,
            'minimum_threshold' => 1,
            'selling_price_cents' => 150,
        ]);

        // Situazione "vecchia" (prima del 5/10): cassa 185 €, un coppone aperto e un credito.
        Carbon::setTestNow('2026-10-01 18:00:00');
        $cash = app(CashService::class);
        $cash->createFromCents(['amount_cents' => 18500, 'direction' => 'entrata', 'type' => 'saldo_iniziale', 'description' => 'Vecchio saldo', 'movement_date' => '2026-10-01'], $this->admin);
        app(WithdrawalService::class)->take($this->birra, $this->luca, $this->admin, 2, 'coppone');
        app(DebtService::class)->pay($this->luca, $this->admin, 500); // 3 € debito + 2 € credito

        // Dal 5/10 in poi: restano validi.
        Carbon::setTestNow('2026-10-05 19:00:00');
        app(WithdrawalService::class)->take($this->birra, $this->luca, $this->admin, 1, 'paid');
        $cash->createFromCents(['amount_cents' => 4552, 'direction' => 'uscita', 'type' => 'acquisto_prodotti', 'description' => 'Spesa 45,52', 'movement_date' => '2026-10-05'], $this->admin);
        Carbon::setTestNow('2026-10-07 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_dry_run_writes_nothing(): void
    {
        $before = CashMovement::withArchived()->count();

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0'])
            ->expectsOutputToContain('Anteprima (dry-run)')
            ->assertSuccessful();

        $this->assertSame($before, CashMovement::withArchived()->count());
        $this->assertSame(0, CashMovement::onlyArchived()->count());
        $this->assertSame(0, AccountReset::count());

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0', '--confirm' => true, '--dry-run' => true])->assertSuccessful();
        $this->assertSame(0, AccountReset::count());
    }

    public function test_missing_opening_cash_stops(): void
    {
        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05'])
            ->expectsOutputToContain('--opening-cash')
            ->assertFailed();
    }

    public function test_reset_archives_old_records_and_restarts_from_opening_cash(): void
    {
        $this->assertSame(18500 + 500 + 150 - 4552, app(CashService::class)->balanceCents());

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '10,00', '--confirm' => true, '--backup-done' => true])
            ->expectsQuestion('Scrivi AZZERA per confermare', 'AZZERA')
            ->assertSuccessful();

        // Saldo = apertura + movimenti dal 5/10 (prelievo pagato 1,50 - spesa 45,52).
        $this->assertSame(1000 + 150 - 4552, app(CashService::class)->balanceCents());
        $this->assertSame(0, (int) MemberDebt::where('status', 'open')->sum('remaining_amount_cents'));
        $this->assertSame(0, app(DebtService::class)->walletCreditCents($this->luca));
        $this->assertSame(1, Withdrawal::count());
        $this->assertSame(1, Withdrawal::onlyArchived()->count());
        $this->assertSame('17.000', $this->birra->fresh()->current_quantity);
        $this->assertDatabaseHas('cash_movements', ['type' => 'saldo_iniziale', 'amount_cents' => 1000, 'archived_at' => null]);

        // Esclusi da contatori e liste.
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/management/summary')->assertJsonPath('open_coppone_cents', 0)->assertJsonPath('balance_cents', 1000 + 150 - 4552);
        $this->getJson('/api/debts')->assertJsonPath('0.open_debt_cents', null);
        $this->assertSame(1, collect($this->getJson('/api/dashboard')->json('top_withdrawn_products'))->sum('total_quantity'));
        $this->getJson('/api/archive?type=debts')->assertOk()->assertJsonPath('records.total', 1)->assertJsonPath('resets.0.opening_cash_cents', 1000);
        $this->artisan('locale:check')->assertSuccessful();

        // Seconda esecuzione: nessun effetto.
        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '10,00', '--confirm' => true, '--backup-done' => true])
            ->expectsOutputToContain('già eseguito')
            ->assertSuccessful();
        $this->assertSame(1, CashMovement::where('type', 'saldo_iniziale')->count());
    }

    public function test_wrong_confirmation_or_missing_backup_writes_nothing(): void
    {
        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0', '--confirm' => true])
            ->expectsOutputToContain('backup')
            ->assertFailed();

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0', '--confirm' => true, '--backup-done' => true])
            ->expectsQuestion('Scrivi AZZERA per confermare', 'si')
            ->assertFailed();

        $this->assertSame(0, AccountReset::count());
        $this->assertSame(0, CashMovement::onlyArchived()->count());
    }

    public function test_also_archive_cash_option_and_undo(): void
    {
        $zeroing = app(CashService::class)->createFromCents(['amount_cents' => 18500, 'direction' => 'uscita', 'type' => 'correzione', 'description' => 'Azzeramento a mano', 'movement_date' => '2026-10-05'], $this->admin);
        $balanceBefore = app(CashService::class)->balanceCents();

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0', '--also-archive-cash' => (string) $zeroing->id, '--confirm' => true, '--backup-done' => true])
            ->expectsQuestion('Scrivi AZZERA per confermare', 'AZZERA')
            ->assertSuccessful();
        $this->assertSame(150 - 4552, app(CashService::class)->balanceCents());

        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--undo' => true, '--confirm' => true, '--backup-done' => true])
            ->expectsQuestion('Scrivi ANNULLA per confermare', 'ANNULLA')
            ->assertSuccessful();

        $this->assertSame($balanceBefore, app(CashService::class)->balanceCents());
        $this->assertSame(0, AccountReset::count());
        $this->assertSame(1, MemberDebt::count());
    }

    public function test_manual_withdrawal_before_cutoff_rejected_after_reset(): void
    {
        $this->artisan('locale:reset-accounts', ['--cutoff' => '2026-10-05', '--opening-cash' => '0', '--confirm' => true, '--backup-done' => true])
            ->expectsQuestion('Scrivi AZZERA per confermare', 'AZZERA')
            ->assertSuccessful();
        Sanctum::actingAs($this->admin);

        $payload = ['member_id' => $this->luca->id, 'product_id' => $this->birra->id, 'quantity' => 1, 'payment_status' => 'coppone', 'withdrawn_time' => '23:30'];
        $this->postJson('/api/withdrawals/manual', [...$payload, 'withdrawn_date' => '2026-10-04'])->assertUnprocessable();
        $this->postJson('/api/withdrawals/manual', [...$payload, 'withdrawn_date' => '2026-10-05', 'withdrawn_time' => '00:30'])->assertCreated();
    }
}
