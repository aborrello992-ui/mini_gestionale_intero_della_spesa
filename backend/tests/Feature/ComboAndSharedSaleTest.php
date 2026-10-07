<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Combo;
use App\Models\Location;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ComboAndSharedSaleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $luca;

    private User $sara;

    private Product $salamini;

    private Product $tarallini;

    private Product $crocchette;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'pin_hash' => '999']);
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca', 'pin_hash' => '111']);
        $this->sara = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Sara', 'pin_hash' => '222']);
        $category = Category::create(['name' => 'Snack']);
        $location = Location::create(['name' => 'Locale']);
        $make = fn (string $name, int $price, float $qty) => Product::create([
            'category_id' => $category->id, 'location_id' => $location->id, 'name' => $name, 'unit' => 'pezzi',
            'current_quantity' => $qty, 'minimum_threshold' => 1, 'selling_price_cents' => $price,
        ]);
        $this->salamini = $make('Salamini', 150, 5);
        $this->tarallini = $make('Tarallini', 100, 5);
        $this->crocchette = $make('Crocchette', 50, 10);
    }

    private function combo(): Combo
    {
        Sanctum::actingAs($this->admin);

        $id = $this->postJson('/api/combos', [
            'name' => 'Salamini + tarallini',
            'price' => '2,00',
            'items' => [['product_id' => $this->salamini->id, 'quantity' => 1], ['product_id' => $this->tarallini->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('list_price_cents', 250)
            ->assertJsonPath('available_count', 5)
            ->json('id');

        return Combo::findOrFail($id);
    }

    public function test_admin_creates_combo_and_member_cannot(): void
    {
        $this->combo();
        $this->getJson('/api/combos')->assertOk()->assertJsonCount(1)->assertJsonPath('0.price_cents', 200);

        Sanctum::actingAs($this->luca);
        $this->postJson('/api/combos', ['name' => 'X', 'price' => 1, 'items' => [['product_id' => $this->salamini->id, 'quantity' => 2]]])->assertForbidden();
    }

    public function test_combo_needs_at_least_two_pieces_and_distinct_products(): void
    {
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/combos', ['name' => 'Uno', 'price' => 1, 'items' => [['product_id' => $this->salamini->id, 'quantity' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->postJson('/api/combos', ['name' => 'Doppio', 'price' => 1, 'items' => [['product_id' => $this->salamini->id, 'quantity' => 1], ['product_id' => $this->salamini->id, 'quantity' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('items.1.product_id');
    }

    public function test_combo_sale_charges_combo_price_and_decrements_each_product(): void
    {
        $combo = $this->combo();
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/sales', [
            'items' => [['combo_id' => $combo->id, 'quantity' => 1]],
            'participants' => [['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid']],
        ])->assertCreated()->assertJsonPath('total_cents', 200)->assertJsonPath('shares.0.total_cents', 200);

        $this->assertSame('4.000', $this->salamini->fresh()->current_quantity);
        $this->assertSame('4.000', $this->tarallini->fresh()->current_quantity);
        $this->assertSame(200, app(CashService::class)->balanceCents());
        $this->assertSame(200, (int) Withdrawal::where('combo_id', $combo->id)->sum('total_amount_cents'));
        // 1,50 e 1,00 di listino => 2,00 ripartiti 120 + 80.
        $this->assertSame(120, Withdrawal::where('product_id', $this->salamini->id)->value('total_amount_cents'));
    }

    public function test_shared_sale_splits_cost_and_quantity_between_members(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/sales', [
            'items' => [['product_id' => $this->crocchette->id, 'quantity' => 10]],
            'participants' => [
                ['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid'],
                ['member_id' => $this->sara->id, 'pin' => '222', 'payment_status' => 'coppone'],
            ],
        ])->assertCreated()
            ->assertJsonPath('total_cents', 500)
            ->assertJsonPath('shares.0.total_cents', 250)
            ->assertJsonPath('shares.1.total_cents', 250);

        $this->assertSame('0.000', $this->crocchette->fresh()->current_quantity);
        $this->assertSame(250, app(CashService::class)->balanceCents());
        $this->assertSame(250, (int) MemberDebt::where('user_id', $this->sara->id)->where('status', 'open')->sum('remaining_amount_cents'));
        $this->assertSame(['5.000', '5.000'], Withdrawal::orderBy('id')->pluck('quantity')->all());
    }

    public function test_shared_combo_with_odd_cents_and_three_people_adds_up(): void
    {
        $combo = $this->combo();
        $third = User::factory()->create(['role' => User::ROLE_MEMBER, 'pin_hash' => '333']);
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/sales', [
            'items' => [['combo_id' => $combo->id, 'quantity' => 1], ['product_id' => $this->crocchette->id, 'quantity' => 1]],
            'participants' => [
                ['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'coppone'],
                ['member_id' => $this->sara->id, 'pin' => '222', 'payment_status' => 'coppone'],
                ['member_id' => $third->id, 'pin' => '333', 'payment_status' => 'coppone'],
            ],
        ])->assertCreated();

        $shares = array_column($response->json('shares'), 'total_cents');
        $this->assertSame(250, array_sum($shares));
        $this->assertLessThanOrEqual(1, max($shares) - min($shares));
        $this->assertSame(250, (int) MemberDebt::sum('remaining_amount_cents'));
        $this->assertSame('9.000', $this->crocchette->fresh()->current_quantity);
        $this->assertSame('4.000', $this->salamini->fresh()->current_quantity);
    }

    public function test_wrong_pin_or_missing_stock_writes_nothing(): void
    {
        Sanctum::actingAs($this->admin);
        $payload = fn (string $pin, float $qty) => [
            'items' => [['product_id' => $this->crocchette->id, 'quantity' => $qty]],
            'participants' => [
                ['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid'],
                ['member_id' => $this->sara->id, 'pin' => $pin, 'payment_status' => 'paid'],
            ],
        ];

        $this->postJson('/api/sales', $payload('000', 2))->assertUnprocessable()->assertJsonValidationErrors('participants.1.pin');
        $this->postJson('/api/sales', $payload('222', 50))->assertUnprocessable()->assertJsonPath('message', 'Non basta «Crocchette»: ne restano 10.');

        $this->assertSame(0, Withdrawal::count());
        $this->assertSame(0, CashMovement::count());
        $this->assertSame('10.000', $this->crocchette->fresh()->current_quantity);
    }

    public function test_sold_combo_is_deactivated_instead_of_deleted(): void
    {
        $combo = $this->combo();
        $this->postJson('/api/sales', [
            'items' => [['combo_id' => $combo->id, 'quantity' => 1]],
            'participants' => [['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid']],
        ])->assertCreated();

        $this->deleteJson("/api/combos/{$combo->id}")->assertOk()->assertJsonPath('deactivated', true);
        $this->assertFalse($combo->fresh()->is_active);
        $this->getJson('/api/combos')->assertJsonCount(0);
        $this->postJson('/api/sales', [
            'items' => [['combo_id' => $combo->id, 'quantity' => 1]],
            'participants' => [['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid']],
        ])->assertUnprocessable();
    }
}
