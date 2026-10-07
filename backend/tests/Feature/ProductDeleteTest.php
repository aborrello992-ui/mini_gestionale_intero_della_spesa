<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductDeleteTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($this->admin);
    }

    private function product(string $name = 'Acqua', float $quantity = 3): Product
    {
        return Product::create([
            'category_id' => Category::firstOrCreate(['name' => 'Bibite'])->id,
            'location_id' => Location::firstOrCreate(['name' => 'Locale'])->id,
            'name' => $name,
            'unit' => 'pezzi',
            'current_quantity' => $quantity,
            'minimum_threshold' => 1,
            'selling_price_cents' => 50,
        ]);
    }

    public function test_product_without_history_is_deleted_with_image_and_audit_log(): void
    {
        Storage::fake('public');
        $product = $this->product();
        $this->postJson("/api/products/{$product->id}/image", ['image' => UploadedFile::fake()->image('a.jpg')])->assertOk();
        $path = $product->fresh()->image_path;

        $this->deleteJson("/api/products/{$product->id}/permanent")->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
        Storage::disk('public')->assertMissing($path);
        $this->assertDatabaseHas('admin_audit_logs', ['admin_id' => $this->admin->id, 'action' => 'product_deleted']);
    }

    public function test_product_with_history_returns_409_and_archive_still_works(): void
    {
        $product = $this->product();
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        Sanctum::actingAs($member);
        $this->postJson('/api/inventory/withdraw', ['product_id' => $product->id, 'quantity' => 1])->assertCreated();
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/products/{$product->id}/permanent")
            ->assertStatus(409)
            ->assertJsonPath('message', 'Questo prodotto ha uno storico: archivialo invece di eliminarlo.');
        $this->assertDatabaseHas('products', ['id' => $product->id]);

        $this->deleteJson("/api/products/{$product->id}")->assertNoContent();
        $this->assertNotNull($product->fresh()->archived_at);
    }

    public function test_member_cannot_delete_product(): void
    {
        $product = $this->product();
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));

        $this->deleteJson("/api/products/{$product->id}/permanent")->assertForbidden();
    }
}
