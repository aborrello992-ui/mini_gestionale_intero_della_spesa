<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class StorageCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_storage_check_reports_working_storage(): void
    {
        Storage::fake('public');
        Http::fake(['*' => Http::response('ok', 200)]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/storage-check')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('steps.scrittura.ok', true)
            ->assertJsonPath('steps.indirizzo_pubblico.ok', true);

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->artisan('locale:storage-check')->assertSuccessful();
    }

    public function test_storage_check_explains_unreachable_public_url(): void
    {
        Storage::fake('public');
        Http::fake(['*' => Http::response('denied', 403)]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/storage-check')
            ->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('steps.indirizzo_pubblico.ok', false);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));
        $this->getJson('/api/storage-check')->assertForbidden();
    }

    public function test_failed_upload_returns_clear_422_and_keeps_old_image(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);
        $product = Product::create([
            'category_id' => Category::create(['name' => 'Bibite'])->id,
            'location_id' => Location::create(['name' => 'Locale'])->id,
            'name' => 'Acqua',
            'unit' => 'pezzi',
            'current_quantity' => 1,
            'minimum_threshold' => 1,
            'image_path' => 'products/vecchia.jpg',
        ]);

        $disk = Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $disk->shouldReceive('putFile')->andReturn(false);
        $disk->shouldNotReceive('delete');
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);

        $this->postJson("/api/products/{$product->id}/image", ['image' => UploadedFile::fake()->image('a.jpg')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image');

        $this->assertSame('products/vecchia.jpg', $product->fresh()->image_path);
    }
}
