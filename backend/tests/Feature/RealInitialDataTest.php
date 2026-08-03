<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RealInitialDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_real_initial_members_inventory_cash_and_debts_are_seeded(): void
    {
        $this->seed();

        $borrello = User::where('name', 'Borrello')->firstOrFail();
        $this->assertSame(User::ROLE_ADMIN, $borrello->role);
        $this->assertTrue(Hash::check('314', $borrello->pin_hash));
        $this->assertSame(['Borre', 'Borry'], $borrello->aliases);

        $this->assertTrue(Hash::check('527', User::where('name', 'Luca Manca')->firstOrFail()->pin_hash));
        $this->assertSame('18.000', Product::where('name', 'Ghiaccioli')->firstOrFail()->current_quantity);
        $this->assertSame(50, Product::where('name', 'Ghiaccioli')->firstOrFail()->selling_price_cents);
        $this->assertSame('0.000', Product::where('name', 'Patatine al formaggio')->firstOrFail()->current_quantity);
        $this->assertSame('10.000', Product::where('name', 'Tè al limone')->firstOrFail()->current_quantity);
        $this->assertSame('5.000', Product::where('name', 'Tè alla pesca')->firstOrFail()->current_quantity);

        $counters = app(CashService::class)->counters();
        $this->assertSame(2130, $counters['balance_cents']);
        $this->assertSame(6430, $counters['open_coppone_cents']);
        $this->assertSame(10820, $counters['inventory_potential_cents']);

        $this->assertSame(3, CashMovement::where('is_opening_historical_record', true)->where('affects_current_balance', false)->count());
        $this->assertSame(16607, (int) CashMovement::where('is_opening_historical_record', true)->sum('amount_cents'));
        $this->assertSame(6430, (int) MemberDebt::where('type', 'debito_pregresso')->sum('remaining_amount_cents'));
    }
}
