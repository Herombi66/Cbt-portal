<?php

namespace Database\Factories;

use App\Models\Exam;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExamFactory extends Factory
{
    protected $model = Exam::class;

    public function definition(): array
    {
        return [
            'title' => $this->faker->sentence(),
            'subject' => $this->faker->word(),
            'class_name' => 'SS3',
            'duration_minutes' => 30,
            'is_active' => true,
        ];
    }
}
