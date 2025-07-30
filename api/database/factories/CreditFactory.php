<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Credit>
 */
class CreditFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
 return [
        'user_id' => User::factory(),
        'amount' => $this->faker->randomFloat(2, 10, 100),
        'description' => 'Crédito',
        'expires_at' => now()->addMonths(3),
        'is_used' => false
    ];
    }
}
