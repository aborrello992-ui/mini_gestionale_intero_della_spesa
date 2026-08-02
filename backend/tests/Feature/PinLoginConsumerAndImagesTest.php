<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\ProductImagesAndNamesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PinLoginConsumerAndImagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_is_in_consumer_selector_and_can_login_with_pin_without_password(): void
    {
        $admin = User::factory()->create(['name' => 'Borrello', 'role' => User::ROLE_ADMIN, 'pin_hash' => '314', 'can_consume' => true]);

        $this->getJson('/api/members')
            ->assertOk()
            ->assertJsonFragment(['id' => $admin->id, 'name' => 'Borrello', 'role' => User::ROLE_ADMIN]);

        $this->postJson('/api/login', ['member_id' => $admin->id, 'pin' => '314'])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_ADMIN)
            ->assertJsonStructure(['token']);

        $this->postJson('/api/login', ['member_id' => $admin->id, 'pin' => '999'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'password'])->assertUnprocessable();
    }

    public function test_admin_can_withdraw_paid_and_coppone_and_get_own_debt(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'pin_hash' => '314', 'can_consume' => true]);
        $category = Category::create(['name' => 'Gelati']);
        $location = Location::create(['name' => 'Locale']);
        $product = Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Ghiacciolo',
            'unit' => 'pezzi',
            'current_quantity' => 5,
            'minimum_threshold' => 1,
            'selling_price_cents' => 50,
        ]);

        Sanctum::actingAs($admin);
        $payload = ['product_id' => $product->id, 'member_id' => $admin->id, 'pin' => '314', 'quantity' => 1];

        $this->postJson('/api/withdrawals', [...$payload, 'payment_status' => 'paid'])->assertCreated();
        $this->postJson('/api/withdrawals', [...$payload, 'payment_status' => 'coppone'])->assertCreated();

        $this->assertDatabaseHas('cash_movements', ['member_id' => $admin->id, 'amount_cents' => 50, 'type' => 'prodotto_pagato']);
        $this->assertDatabaseHas('member_debts', ['user_id' => $admin->id, 'remaining_amount_cents' => 50, 'status' => 'open']);
        $this->getJson('/api/debts')->assertJsonFragment(['id' => $admin->id]);
    }

    public function test_admin_can_create_member_without_email_password_and_pin_is_unique_hash(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/users', [
            'name' => 'Mario',
            'last_name' => 'Rossi',
            'aliases' => ['Marietto'],
            'role' => User::ROLE_MEMBER,
            'is_active' => true,
            'pin' => '007',
            'pin_confirmation' => '007',
        ])->assertCreated()->assertJsonFragment(['name' => 'Mario', 'last_name' => 'Rossi']);

        $member = User::where('name', 'Mario')->firstOrFail();
        $this->assertNotSame('007', $member->pin_hash);
        $this->assertTrue(Hash::check('007', $member->pin_hash));
        $this->assertStringEndsWith('@locale.test', $member->email);

        $this->postJson('/api/users', [
            'name' => 'Duplicato',
            'role' => User::ROLE_MEMBER,
            'is_active' => true,
            'pin' => '007',
            'pin_confirmation' => '007',
        ])->assertUnprocessable();
    }

    public function test_product_image_seeder_renames_without_duplicate_and_associates_existing_image(): void
    {
        $category = Category::create(['name' => 'Gelati']);
        $location = Location::create(['name' => 'Locale']);
        Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Croccante sandwich',
            'unit' => 'pezzi',
            'current_quantity' => 7,
            'minimum_threshold' => 1,
            'selling_price_cents' => 100,
        ]);

        $root = dirname(base_path()).'/product-images';
        File::ensureDirectoryExists($root);
        if (! File::exists($root.'/gelato croccante janduia.webp')) {
            File::put($root.'/gelato croccante janduia.webp', 'fake-webp');
        }

        $this->seed(ProductImagesAndNamesSeeder::class);

        $this->assertDatabaseCount('products', 1);
        $product = Product::firstOrFail();
        $this->assertSame('Gelato croccante alla gianduia', $product->name);
        $this->assertNotNull($product->image_path);
    }
}
