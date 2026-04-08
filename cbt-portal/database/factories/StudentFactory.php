<?php

namespace Database\Factories;

use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class StudentFactory extends Factory
{
    protected $model = Student::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'registration_number' => $this->faker->unique()->numerify('REG/####'),
            'password' => Hash::make('password'),
            'class_name' => 'SS3',
            'is_active' => true,
        ];
    }
}
