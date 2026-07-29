<?php

namespace Database\Seeders;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\User;
use Illuminate\Database\Seeder;

class RealOpeningAccountingSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('name', 'Borrello')->firstOrFail();

        CashMovement::create([
            'user_id' => $admin->id,
            'amount_cents' => 2240,
            'resulting_balance_cents' => 2240,
            'direction' => 'entrata',
            'type' => 'saldo_iniziale',
            'category' => 'apertura',
            'description' => 'Saldo reale presente in cassa all’avvio del gestionale',
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i:s'),
            'affects_current_balance' => true,
        ]);

        collect([
            ['Borrello', 980],
            ['Roberto Squeo', 3840],
            ['Nello Lorusso', 700],
            ['Saverio Squeo', 810],
            ['Luca Manca', 100],
        ])->each(function (array $debt): void {
            $member = User::where('name', $debt[0])->firstOrFail();

            MemberDebt::create([
                'user_id' => $member->id,
                'original_amount_cents' => $debt[1],
                'remaining_amount_cents' => $debt[1],
                'type' => 'debito_pregresso',
                'description' => 'Debito pregresso registrato all’avvio del gestionale',
                'notes' => 'Importo iniziale senza dettaglio prodotto.',
            ]);
        });

        collect([
            ['2026-07-09', 4743, 'Spesa supermercato Eurospin'],
            [null, 7664, 'Spesa supermercato Eurospin'],
            ['2026-07-26', 4200, 'Spesa supermercato Eurospin'],
        ])->each(function (array $expense) use ($admin): void {
            CashMovement::create([
                'user_id' => $admin->id,
                'amount_cents' => $expense[1],
                'resulting_balance_cents' => null,
                'direction' => 'uscita',
                'type' => 'acquisto_prodotti',
                'category' => 'spese storiche',
                'description' => $expense[2],
                'movement_date' => $expense[0] ?? now()->toDateString(),
                'movement_time' => '00:00:00',
                'note' => $expense[0] ? 'Già contabilizzata.' : 'Già contabilizzata. Data originale non disponibile.',
                'status' => 'gia_contabilizzata',
                'affects_current_balance' => false,
                'is_opening_historical_record' => true,
            ]);
        });
    }
}
