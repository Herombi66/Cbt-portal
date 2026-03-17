<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\Question;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CbtApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_crud_and_assign_questions(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'secret123',
        ])->assertOk();

        $token = (string) $login->json('token');

        $question = $this->withToken($token)->postJson('/api/admin/questions', [
            'question_text' => '2 + 2 = ?',
            'option_a' => '3',
            'option_b' => '4',
            'option_c' => '5',
            'option_d' => '6',
            'correct_option' => 'B',
        ])->assertCreated()->json();

        $exam = $this->withToken($token)->postJson('/api/admin/exams', [
            'title' => 'Math Test',
            'duration_minutes' => 30,
            'is_active' => true,
        ])->assertCreated()->json();

        $this->withToken($token)->postJson("/api/admin/exams/{$exam['data']['id']}/assign-questions", [
            'questions' => [
                ['question_id' => $question['data']['id'], 'sort_order' => 1],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('exam_questions', [
            'exam_id' => $exam['data']['id'],
            'question_id' => $question['data']['id'],
            'sort_order' => 1,
        ]);
    }

    public function test_student_can_take_exam_and_submit_answers(): void
    {
        $student = Student::query()->create([
            'name' => 'Student',
            'email' => 'student@example.com',
            'registration_number' => 'REG-001',
            'password' => 'secret123',
        ]);

        $exam = Exam::query()->create([
            'title' => 'Science Test',
            'duration_minutes' => 15,
            'is_active' => true,
        ]);

        $q1 = Question::query()->create([
            'question_text' => 'Water formula?',
            'option_a' => 'H2O',
            'option_b' => 'CO2',
            'option_c' => 'O2',
            'option_d' => 'NaCl',
            'correct_option' => 'A',
        ]);

        $q2 = Question::query()->create([
            'question_text' => 'Earth is a?',
            'option_a' => 'Star',
            'option_b' => 'Planet',
            'option_c' => 'Comet',
            'option_d' => 'Asteroid',
            'correct_option' => 'B',
        ]);

        $exam->questions()->sync([
            $q1->id => ['sort_order' => 1],
            $q2->id => ['sort_order' => 2],
        ]);

        $login = $this->postJson('/api/student/login', [
            'login' => 'student@example.com',
            'password' => 'secret123',
        ])->assertOk();

        $token = (string) $login->json('token');

        $this->withToken($token)->getJson('/api/student/exams')
            ->assertOk()
            ->assertJsonFragment(['id' => $exam->id]);

        $show = $this->withToken($token)->getJson("/api/student/exams/{$exam->id}")
            ->assertOk();

        $show->assertJsonMissing(['correct_option' => 'A']);

        $submit = $this->withToken($token)->postJson("/api/student/exams/{$exam->id}/submit", [
            'answers' => [
                ['question_id' => $q1->id, 'selected_option' => 'A'],
                ['question_id' => $q2->id, 'selected_option' => 'C'],
            ],
        ])->assertCreated();

        $submit->assertJsonPath('data.score', 1);

        $this->assertDatabaseHas('exam_results', [
            'exam_id' => $exam->id,
            'student_id' => $student->id,
            'score' => 1,
            'total_questions' => 2,
        ]);

        $this->assertDatabaseCount('exam_answers', 2);

        $this->withToken($token)->postJson("/api/student/exams/{$exam->id}/submit", [
            'answers' => [
                ['question_id' => $q1->id, 'selected_option' => 'A'],
                ['question_id' => $q2->id, 'selected_option' => 'B'],
            ],
        ])->assertStatus(409);
    }
}

