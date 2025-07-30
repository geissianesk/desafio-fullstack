<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CreditsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
           \App\Models\Credit::factory(10)->create([
        'amount' => fn() => rand(-100, 100),
        'expires_at' => now()->addMonths(3),
        'is_used' => false
    ]);
    }
}
