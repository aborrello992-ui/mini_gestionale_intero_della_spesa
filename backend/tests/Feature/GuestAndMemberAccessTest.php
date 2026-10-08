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
        $response = $this->postJson('/api/guest', ['name' => 'Marco'])->assertOk();

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
        // Stesso nome per piu ospiti attivi: numerato per distinguerli.
        $this->assertSame('Marco 5', $guest->name);
    }

    public function test_guest_must_write_a_valid_name(): void
    {
        $this->postJson('/api/guest')->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/guest', ['name' => 'x'])->assertUnprocessable();
        $this->postJson('/api/guest', ['name' => '<script>'])->assertUnprocessable();

        $first = $this->postJson('/api/guest', ['name' => '  giulia   rossi '])->assertOk();
        $second = $this->postJson('/api/guest', ['name' => 'Anna'])->assertOk();
        $this->assertSame('Giulia Rossi', $first->json('user.name'));
        $this->assertSame('Anna', $second->json('user.name'));
        $this->assertNotSame($first->json('pin'), $second->json('pin'));
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

    public function test_guest_needs_a_sponsor_and_payment_stays_pending(): void
    {
        [$guest] = $this->guest();
        Sanctum::actingAs($guest);
        $payload = ['product_id' => $this->birra->id, 'member_id' => $guest->id, 'quantity' => 1, 'payment_status' => 'paid'];

        $this->postJson('/api/withdrawals', $payload)->assertUnprocessable()->assertJsonValidationErrors('sponsor_id');
        $this->postJson('/api/withdrawals', [...$payload, 'sponsor_id' => $this->luca->id, 'sponsor_pin' => '999'])->assertUnprocessable()->assertJsonValidationErrors('sponsor_pin');
        $this->postJson('/api/withdrawals', [...$payload, 'payment_status' => 'coppone', 'sponsor_id' => $this->luca->id, 'sponsor_pin' => '111'])->assertUnprocessable();

        $this->postJson('/api/withdrawals', [...$payload, 'sponsor_id' => $this->luca->id, 'sponsor_pin' => '111'])
            ->assertCreated()
            ->assertJsonPath('payment_status', 'pending')
            ->assertJsonPath('sponsor_id', $this->luca->id);

        // Magazzino scalato subito, cassa ferma finche un admin non verifica.
        $this->assertSame('19.000', $this->birra->fresh()->current_quantity);
        $this->assertSame(0, CashMovement::count());
    }

    public function test_admin_verifies_guest_payment_paid_or_charges_the_sponsor(): void
    {
        [$guest] = $this->guest();
        Sanctum::actingAs($guest);
        $payload = ['product_id' => $this->birra->id, 'member_id' => $guest->id, 'quantity' => 1, 'payment_status' => 'paid', 'sponsor_id' => $this->luca->id, 'sponsor_pin' => '111'];
        $paid = $this->postJson('/api/withdrawals', $payload)->assertCreated()->json('id');
        $unpaid = $this->postJson('/api/withdrawals', [...$payload, 'quantity' => 2])->assertCreated()->json('id');

        $this->postJson("/api/withdrawals/{$paid}/verify", ['outcome' => 'paid'])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        $this->assertCount(2, $this->getJson('/api/guest-payments')->assertOk()->json());

        $this->postJson("/api/withdrawals/{$paid}/verify", ['outcome' => 'paid'])->assertOk()->assertJsonPath('payment_status', 'paid');
        $this->assertSame(150, (int) CashMovement::where('type', 'prodotto_pagato')->sum('amount_cents'));

        $this->postJson("/api/withdrawals/{$unpaid}/verify", ['outcome' => 'unpaid'])->assertOk()->assertJsonPath('payment_status', 'coppone');
        $this->assertSame(300, (int) MemberDebt::where('user_id', $this->luca->id)->where('status', 'open')->sum('remaining_amount_cents'));

        $this->postJson("/api/withdrawals/{$paid}/verify", ['outcome' => 'unpaid'])->assertUnprocessable();
        $this->assertCount(0, $this->getJson('/api/guest-payments')->json());
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
        ]])->assertCreated()
            ->assertJsonPath('shares.0.total_cents', 150)
            ->assertJsonPath('shares.1.total_cents', 150)
            ->assertJsonPath('shares.1.payment_status', 'pending');
        $this->assertSame($this->luca->id, \App\Models\Withdrawal::where('user_id', $guest->id)->value('sponsor_id'));
        $this->assertSame(0, CashMovement::count());

        // Solo ospiti al tavolo: serve un socio garante.
        [$second, $secondPin] = $this->guest();
        Sanctum::actingAs($guest);
        $this->postJson('/api/sales', ['items' => $items, 'participants' => [
            ['member_id' => $guest->id, 'payment_status' => 'paid'],
            ['member_id' => $second->id, 'pin' => $secondPin, 'payment_status' => 'paid'],
        ]])->assertUnprocessable()->assertJsonPath('message', 'Con gli ospiti deve esserci almeno un socio, che fa da garante.');
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

        $this->postJson('/api/withdrawals', ['product_id' => $this->birra->id, 'member_id' => $guest->id, 'quantity' => 1, 'payment_status' => 'paid', 'sponsor_id' => $this->luca->id, 'sponsor_pin' => '111'])
            ->assertUnprocessable()->assertJsonValidationErrors('member_id');
    }
}
