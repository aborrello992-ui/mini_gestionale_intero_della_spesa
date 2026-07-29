<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class RealMembersSeeder extends Seeder
{
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Dispositivo Locale',
            'email' => 'device@locale.test',
            'role' => User::ROLE_DEVICE,
            'pin_hash' => null,
        ]);

        collect([
            ['Borrello', 'admin@locale.test', User::ROLE_ADMIN, '314', ['Borre', 'Borry']],
            ['Luca Manca', 'luca.manca@locale.test', User::ROLE_MEMBER, '527', []],
            ['Roberto Squeo', 'roberto.squeo@locale.test', User::ROLE_MEMBER, '681', []],
            ['Nello Lorusso', 'nello.lorusso@locale.test', User::ROLE_MEMBER, '742', []],
            ['Saverio Squeo', 'saverio.squeo@locale.test', User::ROLE_MEMBER, '895', []],
        ])->each(fn (array $member) => User::factory()->create([
            'name' => $member[0],
            'email' => $member[1],
            'role' => $member[2],
            'pin_hash' => $member[3],
            'aliases' => $member[4],
        ]));
    }
}
