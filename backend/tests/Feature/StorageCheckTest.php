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
use Mockery;
use Tests\TestCase;

class StorageCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_storage_check_reports_working_storage(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/storage-check')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('steps.scrittura.ok', true)
            ->assertJsonPath('steps.consegna.ok', true);

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->artisan('locale:storage-check')->assertSuccessful();
    }

    public function test_storage_check_is_admin_only(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_MEMBER]));
        $this->getJson('/api/storage-check')->assertForbidden();
    }

    public function test_images_are_served_through_signed_links_even_with_private_bucket(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('receipts/scontrino.jpg', 'jpeg-bytes');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        $product = Product::create([
            'category_id' => Category::create(['name' => 'Bibite'])->id,
            'location_id' => Location::create(['name' => 'Locale'])->id,
            'name' => 'Acqua', 'unit' => 'pezzi', 'current_quantity' => 1, 'minimum_threshold' => 1,
            'image_path' => 'receipts/scontrino.jpg',
        ]);

        $url = $product->image_url;
        $this->assertStringContainsString('/api/media?', $url);
        $this->assertStringContainsString('signature=', $url);

        $this->get($url)->assertOk()->assertHeader('Cache-Control');
        $this->assertSame('jpeg-bytes', $this->get($url)->streamedContent());
        $this->get(str_replace('signature=', 'signature=x', $url))->assertForbidden();
        $this->get('/api/media?path=receipts/scontrino.jpg')->assertForbidden();
    }

    public function test_media_rejects_paths_outside_image_folders(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('diagnostica/x.txt', 'x');
        $url = \Illuminate\Support\Facades\URL::signedRoute('media.show', ['path' => 'diagnostica/x.txt'], absolute: false);

        $this->get($url)->assertNotFound();
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

    public function test_old_storage_links_are_served_from_the_disk(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('receipts/AbCdEf123.jpg', 'jpeg-bytes');

        $this->get('/storage/receipts/AbCdEf123.jpg')->assertOk();
        $this->get('/storage/receipts/manca.jpg')->assertNotFound();
        $this->get('/storage/diagnostica/x.txt')->assertNotFound();
    }

    public function test_storage_check_lists_missing_photos(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));
        Product::create([
            'category_id' => Category::create(['name' => 'Bibite'])->id,
            'location_id' => Location::create(['name' => 'Locale'])->id,
            'name' => 'Acqua', 'unit' => 'pezzi', 'current_quantity' => 1, 'minimum_threshold' => 1,
            'image_path' => 'products/persa.jpg',
        ]);

        $this->getJson('/api/storage-check')
            ->assertJsonPath('steps.foto_esistenti.ok', false)
            ->assertJsonPath('ok', false);
        $this->assertStringContainsString('Acqua', $this->getJson('/api/storage-check')->json('steps.foto_esistenti.message'));
    }
}
