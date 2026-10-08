<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private User $device;
    private User $member;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->device = User::factory()->create(['role' => User::ROLE_DEVICE, 'pin_hash' => null]);
        $this->member = User::factory()->create(['role' => User::ROLE_MEMBER, 'pin_hash' => '125']);
        $this->product = Product::create([
            'category_id' => Category::create(['name' => 'bevande'])->id,
            'location_id' => Location::create(['name' => 'frigo'])->id,
            'name' => 'Cola',
            'unit' => 'bottiglie',
            'current_quantity' => 10,
            'minimum_threshold' => 2,
            'selling_price_cents' => 150,
        ]);
        Sanctum::actingAs($this->device);
    }

    private function take(string $key, array $override = [])
    {
        return $this->withHeader('Idempotency-Key', $key)->postJson('/api/withdrawals', array_merge([
            'product_id' => $this->product->id,
            'member_id' => $this->member->id,
            'pin' => '125',
            'quantity' => 1,
            'payment_status' => 'paid',
        ], $override));
    }

    public function test_same_key_sent_twice_takes_the_product_only_once(): void
    {
        $first = $this->take('chiave-1')->assertCreated();
        $second = $this->take('chiave-1')->assertCreated()->assertHeader('Idempotent-Replayed', 'true');

        $this->assertSame($first->json('id'), $second->json('id'));
        $this->assertSame('9.000', $this->product->fresh()->current_quantity);
        $this->assertDatabaseCount('withdrawals', 1);
        $this->assertDatabaseCount('cash_movements', 1);
    }

    public function test_different_keys_and_no_key_are_separate_operations(): void
    {
        $this->take('chiave-a')->assertCreated();
        $this->take('chiave-b')->assertCreated();
        $this->flushHeaders()->postJson('/api/withdrawals', [
            'product_id' => $this->product->id, 'member_id' => $this->member->id, 'pin' => '125', 'quantity' => 1, 'payment_status' => 'paid',
        ])->assertCreated();

        $this->assertSame('7.000', $this->product->fresh()->current_quantity);
    }

    public function test_failed_operation_frees_the_key_and_wrong_pins_stay_counted(): void
    {
        $this->take('chiave-pin', ['pin' => '999'])->assertUnprocessable();
        $this->assertDatabaseCount('idempotency_keys', 0);

        // Con lo stesso codice si può riprovare con il PIN giusto.
        $this->take('chiave-pin')->assertCreated();
        $this->assertSame('9.000', $this->product->fresh()->current_quantity);

        // I PIN sbagliati continuano a bloccare dopo 5 tentativi, anche con codici anti-doppione.
        foreach (range(1, 5) as $i) {
            $this->take("errato-{$i}", ['pin' => '999'])->assertUnprocessable();
        }
        $blocked = $this->take('dopo-blocco')->assertUnprocessable();
        $this->assertStringContainsString('Troppi tentativi errati', json_encode($blocked->json(), JSON_UNESCAPED_UNICODE));
        $this->assertSame('9.000', $this->product->fresh()->current_quantity);
    }

    public function test_key_still_running_answers_in_progress_and_cannot_be_reused_elsewhere(): void
    {
        DB::table('idempotency_keys')->insert([
            'key' => 'in-corso', 'user_id' => $this->device->id, 'endpoint' => 'POST api/withdrawals',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->take('in-corso')->assertStatus(409)->assertJsonPath('code', 'in_progress');
        $this->assertSame('10.000', $this->product->fresh()->current_quantity);

        $this->take('usata')->assertCreated();
        $this->withHeader('Idempotency-Key', 'usata')->postJson('/api/shopping-list', ['suggested_name' => 'Pane', 'suggested_quantity' => 1])
            ->assertUnprocessable();
    }
}
