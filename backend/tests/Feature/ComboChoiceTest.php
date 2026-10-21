<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Combo;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\CashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Combo con bibita a scelta e cambio del prodotto di un prelievo di combo. */
class ComboChoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $luca;

    private Product $pizza;

    private Product $pepsi;

    private Product $coca;

    private Combo $combo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'pin_hash' => '999']);
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca', 'pin_hash' => '111']);
        $category = Category::create(['name' => 'Cibo']);
        $location = Location::create(['name' => 'Locale']);
        $make = fn (string $name, int $price, float $qty) => Product::create([
            'category_id' => $category->id, 'location_id' => $location->id, 'name' => $name, 'unit' => 'pezzi',
            'current_quantity' => $qty, 'minimum_threshold' => 1, 'selling_price_cents' => $price,
        ]);
        $this->pizza = $make('Pizza', 300, 5);
        $this->pepsi = $make('Pepsi Twist', 100, 5);
        $this->coca = $make('Coca-Cola', 100, 3);

        Sanctum::actingAs($this->admin);
        $id = $this->postJson('/api/combos', [
            'name' => 'Pizza + bibita',
            'price' => '3,50',
            'items' => [
                ['product_id' => $this->pizza->id, 'quantity' => 1],
                ['product_id' => $this->pepsi->id, 'quantity' => 1, 'choice_group' => 1],
                ['product_id' => $this->coca->id, 'quantity' => 1, 'choice_group' => 1],
            ],
        ])->assertCreated()
            ->assertJsonPath('list_price_cents', 400)
            ->assertJsonPath('available_count', 5)
            ->json('id');
        $this->combo = Combo::findOrFail($id);
    }

    private function buy(?int $productId): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/sales', [
            'items' => [['combo_id' => $this->combo->id, 'quantity' => 1, 'choices' => $productId ? [1 => $productId] : []]],
            'participants' => [['member_id' => $this->luca->id, 'pin' => '111', 'payment_status' => 'paid']],
        ]);
    }

    public function test_a_choice_group_needs_two_products_with_the_same_quantity(): void
    {
        $this->postJson('/api/combos', ['name' => 'Solo una', 'price' => 1, 'items' => [
            ['product_id' => $this->pizza->id, 'quantity' => 1],
            ['product_id' => $this->pepsi->id, 'quantity' => 1, 'choice_group' => 1],
        ]])->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->postJson('/api/combos', ['name' => 'Quantita diverse', 'price' => 1, 'items' => [
            ['product_id' => $this->pizza->id, 'quantity' => 1],
            ['product_id' => $this->pepsi->id, 'quantity' => 1, 'choice_group' => 1],
            ['product_id' => $this->coca->id, 'quantity' => 2, 'choice_group' => 1],
        ]])->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_the_chosen_drink_is_charged_and_taken_from_stock(): void
    {
        $this->buy($this->coca->id)->assertCreated()->assertJsonPath('total_cents', 350);

        $this->assertSame('4.000', $this->pizza->fresh()->current_quantity);
        $this->assertSame('5.000', $this->pepsi->fresh()->current_quantity);
        $this->assertSame('2.000', $this->coca->fresh()->current_quantity);
        $this->assertSame(350, app(CashService::class)->balanceCents());
    }

    public function test_the_drink_must_be_chosen_and_belong_to_the_combo(): void
    {
        $this->buy(null)->assertUnprocessable();
        $this->buy($this->pizza->id)->assertUnprocessable();
        $this->assertSame('5.000', $this->pizza->fresh()->current_quantity);
    }

    public function test_admin_changes_the_drink_of_a_combo_withdrawal_without_touching_cash(): void
    {
        $this->buy($this->pepsi->id)->assertCreated();
        $withdrawal = Withdrawal::where('product_id', $this->pepsi->id)->firstOrFail();
        $cashBefore = app(CashService::class)->balanceCents();

        $this->postJson("/api/withdrawals/{$withdrawal->id}/product", ['product_id' => $this->coca->id, 'reason' => 'non gli piaceva la Pepsi'])
            ->assertOk()->assertJsonPath('product_id', $this->coca->id);

        $this->assertSame('5.000', $this->pepsi->fresh()->current_quantity);
        $this->assertSame('2.000', $this->coca->fresh()->current_quantity);
        $this->assertSame($cashBefore, app(CashService::class)->balanceCents());
        $this->assertSame($this->coca->id, $withdrawal->fresh()->product_id);
    }

    public function test_only_combo_withdrawals_can_change_product(): void
    {
        $this->postJson('/api/withdrawals/manual', [
            'member_id' => $this->luca->id, 'product_id' => $this->pepsi->id, 'quantity' => 1, 'payment_status' => 'coppone',
            'withdrawn_date' => now()->toDateString(), 'withdrawn_time' => '12:00',
        ])->assertSuccessful();
        $withdrawal = Withdrawal::whereNull('combo_id')->firstOrFail();

        $this->postJson("/api/withdrawals/{$withdrawal->id}/product", ['product_id' => $this->coca->id, 'reason' => 'prova'])->assertUnprocessable();
    }
}
