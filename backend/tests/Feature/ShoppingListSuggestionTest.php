<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShoppingListSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private function product(string $name, float $quantity, float $threshold = 2): Product
    {
        return Product::create([
            'category_id' => Category::firstOrCreate(['name' => 'Bibite'])->id,
            'location_id' => Location::firstOrCreate(['name' => 'Locale'])->id,
            'name' => $name,
            'unit' => 'pezzi',
            'current_quantity' => $quantity,
            'minimum_threshold' => $threshold,
            'selling_price_cents' => 100,
        ]);
    }

    public function test_reminders_list_low_and_empty_products_not_already_listed(): void
    {
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        Sanctum::actingAs($member);
        $this->product('Acqua', 10);
        $this->product('Birra', 1);
        $coca = $this->product('Coca', 0);
        ShoppingListItem::create(['product_id' => $coca->id, 'user_id' => $member->id, 'suggested_quantity' => 6, 'priority' => 'alta']);

        $names = collect($this->getJson('/api/shopping-list/reminders')->assertOk()->json())->pluck('name')->all();

        $this->assertSame(['Birra'], $names);
    }

    public function test_member_can_suggest_new_product_with_free_category_and_optional_price(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));

        $this->postJson('/api/shopping-list', [
            'suggested_name' => 'Pistacchi',
            'suggested_category' => 'Frutta secca',
            'suggested_quantity' => 2,
            'priority' => 'media',
        ])->assertCreated()->assertJsonPath('product_id', null);

        $this->assertDatabaseHas('shopping_list_items', ['suggested_name' => 'Pistacchi', 'suggested_category' => 'Frutta secca', 'estimated_price_cents' => null]);
    }

    public function test_suggested_name_matching_existing_product_is_linked(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));
        $birra = $this->product('Birra', 5);

        $this->postJson('/api/shopping-list', ['suggested_name' => 'birra', 'suggested_quantity' => 6, 'priority' => 'alta', 'estimated_price' => '4,50'])
            ->assertCreated()
            ->assertJsonPath('product_id', $birra->id);
        $this->assertDatabaseHas('shopping_list_items', ['product_id' => $birra->id, 'suggested_name' => null, 'estimated_price_cents' => 450]);
    }

    public function test_suggestion_bought_as_new_product_is_linked_and_closed(): void
    {
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        $item = ShoppingListItem::create(['suggested_name' => 'Pistacchi', 'user_id' => $member->id, 'suggested_quantity' => 2, 'priority' => 'media']);
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '3.00',
            'purchased_at' => '2026-10-07',
            'purchased_time' => '10:00',
            'items' => [['shopping_list_item_id' => $item->id, 'name' => 'Pistacchi', 'unit' => 'pezzi', 'quantity' => 2, 'line_cost' => '3.00', 'selling_price' => '2']],
        ])->assertCreated();

        $product = Product::where('name', 'Pistacchi')->sole();
        $this->assertDatabaseHas('shopping_list_items', ['id' => $item->id, 'status' => 'acquistato', 'product_id' => $product->id]);
    }

    public function test_only_admin_can_cancel_list_items(): void
    {
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        $item = ShoppingListItem::create(['suggested_name' => 'Pistacchi', 'user_id' => $member->id, 'suggested_quantity' => 2, 'priority' => 'media']);
        Sanctum::actingAs($member);
        $this->deleteJson("/api/shopping-list/{$item->id}")->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        $this->deleteJson("/api/shopping-list/{$item->id}")->assertNoContent();
        $this->assertDatabaseHas('shopping_list_items', ['id' => $item->id, 'status' => 'annullato']);
    }
}
