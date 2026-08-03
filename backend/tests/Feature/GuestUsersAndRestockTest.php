<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GuestUsersAndRestockTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_access_without_password_and_admin_functions_are_blocked(): void
    {
        $token = $this->postJson('/api/guest')->assertOk()->json('token');
        $this->assertNotEmpty($token);

        $guest = User::where('email', 'guest-device@locale.test')->firstOrFail();
        Sanctum::actingAs($guest);

        $this->getJson('/api/products')->assertOk();
        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_real_seed_users_are_visible_to_admin_and_pin_can_be_changed(): void
    {
        $this->seed();
        $admin = User::where('email', 'admin@locale.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Borrello'])
            ->assertJsonFragment(['name' => 'Luca Manca']);

        $luca = User::where('name', 'Luca Manca')->firstOrFail();
        $this->putJson("/api/users/{$luca->id}/pin", ['pin' => '014', 'pin_confirmation' => '014'])->assertOk();
        $this->assertTrue(Hash::check('014', $luca->fresh()->pin_hash));
    }

    public function test_restock_session_updates_multiple_products_and_creates_single_cash_outcome(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $member = User::factory()->create();
        $category = Category::create(['name' => 'Bibite']);
        $location = Location::create(['name' => 'Locale']);
        $product = Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Acqua',
            'unit' => 'pezzi',
            'current_quantity' => 1,
            'minimum_threshold' => 2,
            'selling_price_cents' => 30,
        ]);
        $item = ShoppingListItem::create([
            'product_id' => $product->id,
            'user_id' => $member->id,
            'suggested_quantity' => 10,
            'priority' => 'alta',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '12.50',
            'purchased_at' => now()->toDateString(),
            'purchased_time' => now()->format('H:i'),
            'items' => [
                ['shopping_list_item_id' => $item->id, 'product_id' => $product->id, 'quantity' => 10, 'unit_cost' => '0.25', 'selling_price' => '0.30'],
                ['name' => 'Nuovo snack', 'category' => 'Salato', 'unit' => 'pezzi', 'quantity' => 3, 'unit_cost' => '0.40', 'selling_price' => '0.50', 'minimum_threshold' => 1],
            ],
        ])->assertCreated();

        $this->assertSame('11.000', $product->fresh()->current_quantity);
        $this->assertSame(25, $product->fresh()->last_purchase_price_cents);
        $this->assertDatabaseHas('restock_session_items', ['product_id' => $product->id, 'quantity' => 10, 'unit_cost_cents' => 25, 'cost_cents' => 250]);
        $this->assertDatabaseHas('shopping_list_items', ['id' => $item->id, 'status' => 'acquistato']);
        $this->assertDatabaseHas('products', ['name' => 'Nuovo snack', 'current_quantity' => 3, 'selling_price_cents' => 50, 'average_price_cents' => 40]);
        $this->assertDatabaseCount('cash_movements', 1);
        $this->assertDatabaseHas('cash_movements', ['direction' => 'uscita', 'amount_cents' => 1250, 'type' => 'acquisto_prodotti']);
    }

    public function test_restock_session_accepts_existing_product_outside_list_new_category_photo_and_price_change(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $category = Category::create(['name' => 'Bibite']);
        $location = Location::create(['name' => 'Locale']);
        $existing = Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Birra',
            'unit' => 'bottiglie',
            'current_quantity' => 2,
            'minimum_threshold' => 1,
            'selling_price_cents' => 100,
            'average_price_cents' => 50,
        ]);

        Sanctum::actingAs($admin);
        $this->postJson('/api/shopping-list/restock-sessions', [
            'total_amount' => '5.70',
            'purchased_at' => '2026-08-03',
            'purchased_time' => '10:15',
            'receipt_image' => UploadedFile::fake()->image('scontrino.jpg'),
            'items' => [
                ['product_id' => $existing->id, 'quantity' => 4, 'unit_cost' => '0.80', 'selling_price' => '1.20'],
                ['name' => 'Snack nuovo', 'category' => 'Salato speciale', 'unit' => 'pezzi', 'quantity' => 5, 'unit_cost' => '0.50', 'selling_price' => '0.80', 'image' => UploadedFile::fake()->image('snack.webp')],
            ],
        ])->assertCreated();

        $this->assertSame('6.000', $existing->fresh()->current_quantity);
        $this->assertSame(80, $existing->fresh()->last_purchase_price_cents);
        $this->assertSame(70, $existing->fresh()->average_price_cents);
        $this->assertSame(120, $existing->fresh()->selling_price_cents);
        $this->assertDatabaseHas('categories', ['name' => 'Salato speciale']);
        $this->assertDatabaseHas('products', ['name' => 'Snack nuovo', 'current_quantity' => 5, 'selling_price_cents' => 80, 'last_purchase_price_cents' => 50]);
        $this->assertDatabaseHas('restock_sessions', ['total_cents' => 570, 'difference_cents' => 0]);
        $this->assertDatabaseHas('cash_movements', ['direction' => 'uscita', 'amount_cents' => 570]);
        $this->assertDatabaseCount('cash_movements', 1);
    }

    public function test_management_accepts_simplified_form(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/management/movements', [
            'type' => 'spesa_generica',
            'direction' => 'entrata',
            'amount' => '10.00',
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i'),
        ])->assertCreated();

        $this->assertDatabaseHas('cash_movements', ['category' => 'spesa_generica', 'description' => 'Spesa generica', 'amount_cents' => 1000]);
    }
}
