<?php

namespace Database\Seeders;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\PurchaseService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::factory()->create([
            'name' => 'Admin Locale',
            'email' => 'admin@locale.test',
            'role' => User::ROLE_ADMIN,
        ]);

        $members = collect(range(1, 5))->map(fn ($i) => User::factory()->create([
            'name' => "Membro {$i}",
            'email' => "membro{$i}@locale.test",
            'role' => User::ROLE_MEMBER,
        ]));

        $categories = collect(['bevande', 'snack', 'alimenti', 'prodotti per la pulizia', 'altro'])
            ->mapWithKeys(fn ($name) => [$name => Category::create(['name' => $name])]);

        $locations = collect(['frigo', 'dispensa', 'magazzino', 'altro'])
            ->mapWithKeys(fn ($name) => [$name => Location::create(['name' => $name])]);

        $products = collect([
            ['Acqua naturale', 'bevande', 'frigo', 'bottiglie', 12, 4, 45],
            ['Birra chiara', 'bevande', 'frigo', 'bottiglie', 8, 6, 120],
            ['Cola', 'bevande', 'frigo', 'bottiglie', 3, 4, 95],
            ['Patatine', 'snack', 'dispensa', 'confezioni', 5, 3, 180],
            ['Arachidi', 'snack', 'dispensa', 'confezioni', 2, 3, 220],
            ['Pasta', 'alimenti', 'dispensa', 'confezioni', 6, 2, 140],
            ['Passata', 'alimenti', 'dispensa', 'bottiglie', 0, 2, 110],
            ['Carta cucina', 'altro', 'magazzino', 'pezzi', 4, 2, 250],
            ['Detersivo piatti', 'prodotti per la pulizia', 'magazzino', 'bottiglie', 1, 2, 240],
            ['Bicchieri compostabili', 'altro', 'magazzino', 'confezioni', 10, 3, 320],
        ])->map(fn ($row) => Product::create([
            'name' => $row[0],
            'category_id' => $categories[$row[1]]->id,
            'location_id' => $locations[$row[2]]->id,
            'unit' => $row[3],
            'current_quantity' => $row[4],
            'minimum_threshold' => $row[5],
            'average_price_cents' => $row[6],
            'last_purchase_price_cents' => $row[6],
        ]));

        app(PurchaseService::class)->create([
            'purchased_at' => now()->toDateString(),
            'supplier' => 'Supermercato Demo',
            'receipt_number' => 'SC-001',
            'note' => 'Primo rifornimento demo',
            'items' => [
                ['product_id' => $products[0]->id, 'quantity' => 6, 'unit_cost' => '0.45'],
                ['product_id' => $products[3]->id, 'quantity' => 4, 'unit_cost' => '1.80'],
                ['product_id' => $products[9]->id, 'quantity' => 2, 'unit_cost' => '3.20'],
            ],
        ], $admin);

        app(InventoryService::class)->withdraw($products[0]->fresh(), $members[0], 1, 'Prelievo demo');
        app(InventoryService::class)->withdraw($products[3]->fresh(), $members[1], 2, 'Serata film');

        CashMovement::create([
            'user_id' => $admin->id,
            'amount_cents' => 5000,
            'direction' => 'entrata',
            'type' => 'versamento',
            'category' => 'cassa iniziale',
            'description' => 'Fondo iniziale di sviluppo',
            'movement_date' => now()->subDay()->toDateString(),
        ]);

        foreach ([2, 4, 6, 8] as $index) {
            ShoppingListItem::create([
                'product_id' => $products[$index]->id,
                'user_id' => $members->random()->id,
                'suggested_quantity' => 3,
                'priority' => $index === 6 ? 'alta' : 'media',
                'note' => 'Da controllare al prossimo giro spesa',
            ]);
        }
    }
}
