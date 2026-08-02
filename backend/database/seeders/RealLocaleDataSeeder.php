<?php

namespace Database\Seeders;

use App\Models\CashMovement;
use App\Models\Category;
use App\Models\Location;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\RestockSession;
use App\Models\User;
use App\Models\Withdrawal;
use App\Support\NameNormalizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RealLocaleDataSeeder extends Seeder
{
    private array $summary = ['created' => 0, 'updated' => 0, 'present' => 0, 'conflicts' => []];

    public function run(): void
    {
        DB::transaction(function (): void {
            $users = $this->restoreUsers();
            $this->restoreProducts();
            $this->restoreOpeningCash($users['Borrello']);
            $this->restoreOpeningDebts($users);
            $this->restoreHistoricalExpenses($users['Borrello']);
        });

        $this->command?->info('RealLocaleDataSeeder summary: '.json_encode($this->summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    private function restoreUsers(): array
    {
        $users = [];
        foreach ([
            ['Borrello', 'admin@locale.test', User::ROLE_ADMIN, '314', ['Borre', 'Borry']],
            ['Luca Manca', 'luca.manca@locale.test', User::ROLE_MEMBER, '527', []],
            ['Roberto Squeo', 'roberto.squeo@locale.test', User::ROLE_MEMBER, '681', []],
            ['Nello Lorusso', 'nello.lorusso@locale.test', User::ROLE_MEMBER, '742', []],
            ['Saverio Squeo', 'saverio.squeo@locale.test', User::ROLE_MEMBER, '895', []],
        ] as [$name, $email, $role, $pin, $aliases]) {
            $user = User::where('email', $email)->orWhere('name', $name)->first();
            $payload = [
                'name' => $name,
                'email' => $email,
                'password' => 'password',
                'role' => $role,
                'pin_hash' => $pin,
                'aliases' => $aliases,
                'is_active' => true,
            ];

            if ($user) {
                $user->update($payload);
                $this->summary['updated']++;
            } else {
                $user = User::create($payload);
                $this->summary['created']++;
            }
            $users[$name] = $user->fresh();
        }

        User::firstOrCreate(
            ['email' => 'device@locale.test'],
            ['name' => 'Dispositivo Locale', 'password' => 'password', 'role' => User::ROLE_DEVICE, 'is_active' => true],
        );

        return $users;
    }

    private function restoreProducts(): void
    {
        $categories = collect(['Gelati', 'Bibite', 'Salato'])->mapWithKeys(
            fn (string $name) => [$name => Category::firstOrCreate(['name' => $name])]
        );
        $location = Location::firstOrCreate(['name' => 'Locale'], ['description' => 'Rimanenze iniziali del locale']);
        $hasOperationalMovements = Withdrawal::exists() || RestockSession::exists() || DB::table('inventory_movements')->exists();

        foreach ([
            ['Ghiacciolo', ['Ghiaccioli'], 'Gelati', 18, 50],
            ['Mini cono', ['Mini coni'], 'Gelati', 14, 60],
            ['Gelato Luke', ['Gelati Luke'], 'Gelati', 3, 60],
            ['Gelato croccante alla gianduia', ['Croccante sandwich', 'Gelato croccante janduia'], 'Gelati', 7, 100],
            ['Mini stecchino', ['Mini stecchini'], 'Gelati', 9, 60],
            ['Cucciolone', [], 'Gelati', 1, 100],
            ['Gelato al pistacchio', [], 'Gelati', 1, 100],
            ['Bitter', [], 'Bibite', 5, 40],
            ['Acqua', [], 'Bibite', 62, 30],
            ['Limonata', [], 'Bibite', 12, 100],
            ['Coca-Cola', [], 'Bibite', 6, 100],
            ['Tè alla pesca', [], 'Bibite', 13, 80],
            ['Tè al limone', [], 'Bibite', 2, 80],
            ['Succo', [], 'Bibite', 2, 50],
            ['Birra', [], 'Bibite', 12, 100],
            ['Croccantelle', [], 'Salato', 2, 50],
            ['Patatine al formaggio', [], 'Salato', 0, 50],
            ['Patatine classiche', [], 'Salato', 12, 50],
            ['Chips', [], 'Salato', 8, 50],
        ] as [$name, $legacyNames, $category, $quantity, $price]) {
            $normalizedNames = collect([$name, ...$legacyNames])->map(fn ($value) => NameNormalizer::normalize($value));
            $product = Product::whereIn('normalized_name', $normalizedNames)->first();
            $payload = [
                'name' => $name,
                'category_id' => $categories[$category]->id,
                'location_id' => $location->id,
                'unit' => 'pezzi',
                'minimum_threshold' => 2,
                'stock_reference_quantity' => max($quantity, 10),
                'selling_price_cents' => $price,
                'image_alt' => $name,
                'is_active' => true,
                'archived_at' => null,
            ];

            if (! $hasOperationalMovements) {
                $payload['current_quantity'] = $quantity;
            } elseif ($product && (float) $product->current_quantity !== (float) $quantity) {
                $this->summary['conflicts'][] = "{$name}: quantita attuale {$product->current_quantity}, iniziale {$quantity}; non sovrascritta.";
            }

            if ($product) {
                $product->update($payload);
                $this->summary['updated']++;
            } else {
                Product::create(['current_quantity' => $quantity, ...$payload]);
                $this->summary['created']++;
            }
        }
    }

    private function restoreOpeningCash(User $admin): void
    {
        $payload = [
                'user_id' => $admin->id,
                'amount_cents' => 2240,
                'resulting_balance_cents' => 2240,
                'direction' => 'entrata',
                'type' => 'saldo_iniziale',
                'category' => 'apertura',
                'description' => 'Saldo reale presente in cassa all’avvio del gestionale',
                'movement_date' => '2026-07-29',
                'movement_time' => '00:00:00',
                'occurred_at' => '2026-07-29 00:00:00',
                'affects_current_balance' => true,
                'is_opening_historical_record' => false,
                'status' => 'active',
        ];

        $movement = $this->upsertCashMovementByStableKey(
            'opening_cash_balance_2026_07_29',
            fn () => CashMovement::whereNull('restoration_key')
                ->where('type', 'saldo_iniziale')
                ->where('amount_cents', 2240)
                ->where('direction', 'entrata')
                ->first(),
            $payload,
        );
        $this->summary[$movement->wasRecentlyCreated ? 'created' : 'updated']++;
    }

    private function restoreOpeningDebts(array $users): void
    {
        foreach ([
            'opening_debt_borrello' => ['Borrello', 980],
            'opening_debt_luca_manca' => ['Luca Manca', 100],
            'opening_debt_roberto_squeo' => ['Roberto Squeo', 3840],
            'opening_debt_nello_lorusso' => ['Nello Lorusso', 700],
            'opening_debt_saverio_squeo' => ['Saverio Squeo', 810],
        ] as $key => [$name, $amount]) {
            $existing = MemberDebt::where('restoration_key', $key)
                ->orWhere(fn ($q) => $q->where('user_id', $users[$name]->id)->where('type', 'debito_pregresso'))
                ->first();
            $payload = [
                'restoration_key' => $key,
                'user_id' => $users[$name]->id,
                'original_amount_cents' => $amount,
                'paid_amount_cents' => 0,
                'remaining_amount_cents' => $amount,
                'type' => 'debito_pregresso',
                'description' => 'Debito pregresso all’avvio del gestionale',
                'notes' => 'Debito pregresso registrato dal ripristino dati reali.',
                'status' => 'open',
            ];

            if ($existing) {
                $existing->update($payload);
                $this->summary['updated']++;
            } else {
                MemberDebt::create($payload);
                $this->summary['created']++;
            }
        }
    }

    private function restoreHistoricalExpenses(User $admin): void
    {
        foreach ([
            'historical_expense_2026_07_09_47_43' => ['2026-07-09', '2026-07-09 00:00:00', false, 4743],
            'historical_expense_unknown_76_64' => ['2026-07-29', null, true, 7664],
            'historical_expense_2026_07_26_42_00' => ['2026-07-26', '2026-07-26 00:00:00', false, 4200],
        ] as $key => [$movementDate, $occurredAt, $isApproximate, $amount]) {
            $payload = [
                    'user_id' => $admin->id,
                    'amount_cents' => $amount,
                    'resulting_balance_cents' => null,
                    'direction' => 'uscita',
                    'type' => 'acquisto_prodotti',
                    'category' => 'spese storiche',
                    'description' => 'Spesa supermercato Eurospin',
                    'movement_date' => $movementDate,
                    'movement_time' => '00:00:00',
                    'occurred_at' => $occurredAt,
                    'occurred_at_is_approximate' => $isApproximate,
                    'note' => $isApproximate ? 'Già contabilizzata. Data originale non disponibile.' : 'Già contabilizzata.',
                    'status' => 'gia_contabilizzata',
                    'affects_current_balance' => false,
                    'is_opening_historical_record' => true,
            ];

            $movement = $this->upsertCashMovementByStableKey(
                $key,
                fn () => CashMovement::whereNull('restoration_key')
                    ->where('type', 'acquisto_prodotti')
                    ->where('amount_cents', $amount)
                    ->where('direction', 'uscita')
                    ->where('is_opening_historical_record', true)
                    ->first(),
                $payload,
            );
            $this->summary[$movement->wasRecentlyCreated ? 'created' : 'updated']++;
        }
    }

    private function upsertCashMovementByStableKey(string $key, callable $legacyFinder, array $payload): CashMovement
    {
        $keyed = CashMovement::where('restoration_key', $key)->first();
        $legacy = $legacyFinder();

        if ($legacy && $keyed && $legacy->id !== $keyed->id) {
            $keyed->delete();
            $keyed = null;
        }

        $movement = $legacy ?: $keyed;

        if ($movement) {
            $movement->update(['restoration_key' => $key, ...$payload]);

            return $movement;
        }

        return CashMovement::create(['restoration_key' => $key, ...$payload]);
    }
}
