<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductArchiveAndManagementSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_upload_replace_remove_archive_and_restore_product_image(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $product = $this->product();
        Sanctum::actingAs($admin);

        $this->postJson("/api/products/{$product->id}/image", [
            'image' => UploadedFile::fake()->image('acqua.jpg'),
            'image_alt' => 'Bottiglia acqua',
        ])->assertOk();
        $firstPath = $product->fresh()->image_path;
        $this->assertNotNull($firstPath);
        Storage::disk('public')->assertExists($firstPath);

        $this->postJson("/api/products/{$product->id}/image", [
            'image' => UploadedFile::fake()->image('acqua.png'),
            'image_alt' => 'Acqua nuova',
        ])->assertOk();
        Storage::disk('public')->assertMissing($firstPath);
        Storage::disk('public')->assertExists($product->fresh()->image_path);

        $this->deleteJson("/api/products/{$product->id}/image")->assertOk();
        $this->assertNull($product->fresh()->image_path);

        $this->deleteJson("/api/products/{$product->id}", ['archive_reason' => 'Non acquistato'])->assertNoContent();
        $this->assertNotNull($product->fresh()->archived_at);
        $this->getJson('/api/products')->assertJsonMissing(['name' => $product->name]);
        $this->getJson('/api/products?include_archived=1&state=archived')->assertJsonFragment(['name' => $product->name]);

        $this->postJson("/api/products/{$product->id}/restore")->assertOk();
        $this->assertNull($product->fresh()->archived_at);
    }

    public function test_management_movements_are_separated_and_personal_requires_member(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $member = User::factory()->create(['role' => User::ROLE_MEMBER]);
        Sanctum::actingAs($admin);

        $payload = ['amount' => '10.00', 'movement_date' => now()->toDateString(), 'movement_time' => now()->format('H:i')];
        $this->postJson('/api/management/movements', [...$payload, 'type' => 'accredito', 'direction' => 'entrata'])->assertUnprocessable();
        $this->postJson('/api/management/movements', [...$payload, 'type' => 'accredito', 'direction' => 'entrata', 'member_id' => $member->id])->assertCreated();
        $this->postJson('/api/management/movements', [...$payload, 'type' => 'spesa_generica', 'direction' => 'uscita'])->assertCreated();

        $this->assertDatabaseHas('cash_movements', ['category' => 'movimento_personale', 'member_id' => $member->id, 'direction' => 'entrata', 'amount_cents' => 1000]);
        $this->assertDatabaseHas('cash_movements', ['category' => 'spesa_generica', 'member_id' => null, 'direction' => 'uscita', 'amount_cents' => 1000]);
        $this->getJson('/api/cash/balance')->assertJsonPath('balance_cents', 0);
    }

    private function product(): Product
    {
        $category = Category::create(['name' => 'Bibite']);
        $location = \App\Models\Location::create(['name' => 'Locale']);

        return Product::create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Acqua',
            'unit' => 'pezzi',
            'current_quantity' => 12,
            'minimum_threshold' => 2,
            'selling_price_cents' => 30,
        ]);
    }
}
