<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Database\Seeder;

class RealInventorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = collect(['Gelati', 'Bibite', 'Salato'])
            ->mapWithKeys(fn (string $name) => [$name => Category::create(['name' => $name])]);

        $location = Location::create(['name' => 'Locale', 'description' => 'Rimanenze iniziali del locale']);

        collect([
            ['Ghiaccioli', 'Gelati', 18, 50],
            ['Mini coni', 'Gelati', 14, 60],
            ['Gelati Luke', 'Gelati', 3, 60],
            ['Croccante sandwich', 'Gelati', 7, 100],
            ['Mini stecchini', 'Gelati', 9, 60],
            ['Cucciolone', 'Gelati', 1, 100],
            ['Gelato al pistacchio', 'Gelati', 1, 100],
            ['Bitter', 'Bibite', 5, 40],
            ['Acqua', 'Bibite', 62, 30],
            ['Limonata', 'Bibite', 12, 100],
            ['Coca-Cola', 'Bibite', 6, 100],
            ['Tè alla pesca', 'Bibite', 5, 80],
            ['Tè al limone', 'Bibite', 10, 80],
            ['Succo', 'Bibite', 2, 50],
            ['Birra', 'Bibite', 12, 100],
            ['Croccantelle', 'Salato', 2, 50],
            ['Patatine al formaggio', 'Salato', 0, 50],
            ['Patatine classiche', 'Salato', 12, 50],
            ['Chips', 'Salato', 8, 50],
        ])->each(function (array $product) use ($categories, $location): void {
            Product::create([
                'name' => $product[0],
                'category_id' => $categories[$product[1]]->id,
                'location_id' => $location->id,
                'unit' => 'pezzi',
                'current_quantity' => $product[2],
                'minimum_threshold' => 2,
                'stock_reference_quantity' => max($product[2], 10),
                'average_price_cents' => 0,
                'last_purchase_price_cents' => 0,
                'selling_price_cents' => $product[3],
                'image_alt' => $product[0],
            ]);
        });
    }
}
