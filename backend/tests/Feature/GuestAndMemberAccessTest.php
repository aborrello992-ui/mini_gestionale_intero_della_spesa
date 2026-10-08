<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Location;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GuestAndMemberAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $luca;

    private User $sara;

    private Product $birra;

    protected function setUp(): void
    {
        parent::setUp();
        $this->luca = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Luca', 'pin_hash' => '111']);
        $this->sara = User::factory()->create(['role' => User::ROLE_MEMBER, 'name' => 'Sara', 'pin_hash' => '222']);
        $this->birra = Product::create([
            'category_id' => Category::create(['name' => 'Bibite'])->id,
            'location_id' => Location::create(['name' => 'Locale'])->id,
            'name' => 'Birra', 'unit' => 'bottiglie', 'current_quantity' => 20, 'minimum_threshold' => 1, 'selling_price_cents' => 150,
        ]);
    }

    private function guest(): array
    {
        $response = $this->postJson('/api/guest')->assertOk();

        return [User::findOrFail($response->json('user.id')), $response->json('pin')];
    }

    public function test_each_guest_gets_a_unique_pin_different_from_members(): void
    {
        $pins = [];
        for ($i = 0; $i < 5; $i++) {
            [$guest, $pin] = $this->guest();
            $this->assertTrue(Hash::check($pin, $guest->pin_hash));
            $this->assertNotContains($pin, ['111', '222']);
            $pins[] = $pin;
        }
        $this->assertCount(5, array_unique($pins));
        $this->assertSame('Ospite 5', $guest->name);
    }

    public function test_guest_cannot_see_debts_cash_or_history(): void
    {
        [$guest] = $this->guest();
        Sanctum::actingAs($guest);

        $this->getJson('/api/products')->assertOk();
        $this->getJson('/api/debts')->assertForbidden();
        $this->getJson('/api/cash/balance')->assertForbidden();
        $this->getJson('/api/history')->assertForbidden();
    }

    public function test_guest_takes_for_himself_without_pin_but_only_paid(): void
    {
        [$guest] = $this->guest();
        Sanctum::actingAs($guest);
        $payload = ['product_id' => $this->birra->id, 'member_id' => $guest->id, 'quantity' => 1];

        $this->postJson('/api/withdrawals', [...$payload, 'payment_status' => 'coppone'])
            ->assertUnprocessable()->assertJsonPath('message', "{$guest->name} è un ospite: paga subito, niente coppone.");
        $this->postJson('/api/withdrawals', [...$payload, 'payment_status' => 'paid'])->assertCreated();

        $this->assertSame(150, (int) CashMovement::where('member_id', $guest->id)->sum('amount_cents'));
        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $this->luca->id, 'quantity' => 1, 'payment_status' => 'paid'])
            ->assertUnprocessable()->assertJsonValidationErrors('pin');
    }

    public function test_member_logged_in_with_pin_takes_without_retyping_it(): void
    {
        $token = $this->postJson('/api/login', ['member_id' => $this->luca->id, 'pin' => '111'])->assertOk()->json('token');
        $this->assertNotEmpty($token);
        Sanctum::actingAs($this->luca);

        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $this->luca->id, 'quantity' => 2, 'payment_status' => 'coppone'])->assertCreated();
        $this->assertSame(300, (int) MemberDebt::where('user_id', $this->luca->id)->sum('remaining_amount_cents'));

        // Per un altro socio serve il suo PIN.
        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $this->sara->id, 'quantity' => 1, 'payment_status' => 'paid'])
            ->assertUnprocessable()->assertJsonValidationErrors('pin');
        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $this->sara->id, 'pin' => '222', 'quantity' => 1, 'payment_status' => 'paid'])->assertCreated();
    }

    public function test_eat_with_a_friend_only_the_friend_types_the_pin_and_guests_can_join(): void
    {
        [$guest, $guestPin] = $this->guest();
        Sanctum::actingAs($this->luca);
        $items = [['product_id' => $this->birra->id, 'quantity' => 2]];

        $this->postJson('/api/sales', ['items' => $items, 'participants' => [
            ['member_id' => $this->luca->id, 'payment_status' => 'coppone'],
            ['member_id' => $guest->id, 'payment_status' => 'paid'],
        ]])->assertUnprocessable()->assertJsonValidationErrors('participants.1.pin');

        $this->postJson('/api/sales', ['items' => $items, 'participants' => [
            ['member_id' => $this->luca->id, 'payment_status' => 'coppone'],
            ['member_id' => $guest->id, 'pin' => $guestPin, 'payment_status' => 'coppone'],
        ]])->assertUnprocessable();

        $this->postJson('/api/sales', ['items' => $items, 'participants' => [
            ['member_id' => $this->luca->id, 'payment_status' => 'coppone'],
            ['member_id' => $guest->id, 'pin' => $guestPin, 'payment_status' => 'paid'],
        ]])->assertCreated()->assertJsonPath('shares.0.total_cents', 150)->assertJsonPath('shares.1.total_cents', 150);
    }

    public function test_members_list_hides_guests_unless_asked_and_logout_ends_guest(): void
    {
        [$guest] = $this->guest();

        $this->assertNotContains($guest->id, array_column($this->getJson('/api/members')->json(), 'id'));
        $this->assertContains($guest->id, array_column($this->getJson('/api/members?include_guests=1')->json(), 'id'));

        Sanctum::actingAs($guest);
        $this->postJson('/api/logout')->assertOk();
        $this->assertFalse($guest->fresh()->is_active);
        $this->assertNotContains($guest->id, array_column($this->getJson('/api/members?include_guests=1')->json(), 'id'));
    }

    public function test_expired_guest_cannot_take_products(): void
    {
        [$guest] = $this->guest();
        $guest->update(['guest_expires_at' => now()->subMinute()]);
        Sanctum::actingAs($guest->fresh());

        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $guest->id, 'quantity' => 1, 'payment_status' => 'paid'])
            ->assertUnprocessable()->assertJsonValidationErrors('member_id');
    }
}
