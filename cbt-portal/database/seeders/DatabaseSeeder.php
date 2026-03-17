<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Default super-admin account
        User::factory()->create([
            'name' => 'Super Admin',
            'email' => 'admin@cbtportal.edu',
            'password' => \Illuminate\Support\Facades\Hash::make('admin123'),
            'role' => 'super_admin',
        ]);

        // Default test student
        \App\Models\Student::factory()->create([
            'name' => 'Test Student',
            'registration_number' => 'STU/2024/001',
            'email' => 'student@cbtportal.edu',
            'password' => \Illuminate\Support\Facades\Hash::make('password123'),
        ]);
    }
}
