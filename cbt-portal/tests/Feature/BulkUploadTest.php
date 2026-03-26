<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulkUploadTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'secret123',
        ]);

        $this->token = $login->json('token');
    }

    public function test_can_bulk_upload_300_plus_questions(): void
    {
        $questions = [];
        for ($i = 1; $i <= 350; $i++) {
            $questions[] = [
                'subject' => 'Math',
                'class_name' => 'SS3',
                'question_text' => "Question $i",
                'type' => 'mcq',
                'option_a' => 'A',
                'option_b' => 'B',
                'option_c' => 'C',
                'option_d' => 'D',
                'correct_option' => 'A',
            ];
        }

        $response = $this->withToken($this->token)
            ->postJson('/api/admin/questions/bulk', [
                'questions' => $questions,
            ]);

        $response->assertStatus(201)
            ->assertJsonCount(350, 'data')
            ->assertJson(['message' => '350 questions imported successfully.']);

        $this->assertEquals(350, Question::count());
    }

    public function test_bulk_upload_fails_on_validation_error_and_rolls_back(): void
    {
        $questions = [
            [
                'subject' => 'Math',
                'class_name' => 'SS3',
                'question_text' => "Valid Question",
                'type' => 'mcq',
                'option_a' => 'A',
                'option_b' => 'B',
                'option_c' => 'C',
                'option_d' => 'D',
                'correct_option' => 'A',
            ],
            [
                'subject' => 'Math',
                // Missing class_name
                'question_text' => "Invalid Question",
                'type' => 'mcq',
                'option_a' => 'A',
                'option_b' => 'B',
                'option_c' => 'C',
                'option_d' => 'D',
                'correct_option' => 'A',
            ],
        ];

        $response = $this->withToken($this->token)
            ->postJson('/api/admin/questions/bulk', [
                'questions' => $questions,
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors']);

        // Database should be empty because of transaction rollback (actually validation happens before transaction, so it's empty anyway)
        $this->assertEquals(0, Question::count());
    }

    public function test_admin_can_fetch_up_to_1000_questions(): void
    {
        Question::factory()->count(150)->create();

        $response = $this->withToken($this->token)
            ->getJson('/api/admin/questions?per_page=1000');

        $response->assertStatus(200)
            ->assertJsonCount(150, 'data');
    }

    public function test_can_bulk_delete_questions(): void
    {
        $questions = Question::factory()->count(10)->create();
        $ids = $questions->pluck('id')->toArray();

        $response = $this->withToken($this->token)
            ->deleteJson('/api/admin/questions/bulk', [
                'ids' => $ids,
            ]);

        $response->assertStatus(200)
            ->assertJson(['message' => '10 questions deleted successfully.']);

        $this->assertEquals(0, Question::count());
    }

    public function test_bulk_delete_fails_on_invalid_ids(): void
    {
        $response = $this->withToken($this->token)
            ->deleteJson('/api/admin/questions/bulk', [
                'ids' => [9999, 8888],
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors']);
    }
}
