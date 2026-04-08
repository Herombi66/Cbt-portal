<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Student;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamTimerTest extends TestCase
{
    use RefreshDatabase;

    public function test_exam_time_is_correctly_restored_after_relogin(): void
    {
        // 1. Setup an exam and a student
        $exam = Exam::factory()->create([
            'duration_minutes' => 30,
            'is_active' => true,
        ]);
        $student = Student::factory()->create();

        // 2. Start an exam session at a specific time (e.g., 10 minutes ago)
        $now = CarbonImmutable::now();
        $startTime = $now->subMinutes(10);

        $session = ExamSession::create([
            'student_id' => $student->id,
            'exam_id' => $exam->id,
            'status' => 'in_progress',
            'start_time' => $startTime,
            'last_synced_at' => $startTime,
            'current_question_index' => 0,
            'answers_provided' => [],
        ]);

        // 3. Act: Call checkActiveSession (simulating re-login)
        $this->actingAs($student);
        $response = $this->getJson('/api/student/active-session');

        // 4. Assert: Remaining time should be approximately 20 minutes (1200 seconds)
        $response->assertStatus(200);
        $remaining = $response->json('remaining_seconds');
        $this->assertGreaterThanOrEqual(1199, $remaining);
        $this->assertLessThanOrEqual(1201, $remaining);
        $response->assertJsonPath('session.id', $session->id);
    }

    public function test_exam_time_does_not_inflate_due_to_negative_elapsed_time(): void
    {
        // 1. Setup
        $exam = Exam::factory()->create(['duration_minutes' => 30, 'is_active' => true]);
        $student = Student::factory()->create();

        // 2. Simulate a session started in the "future" (e.g., due to clock drift)
        $now = CarbonImmutable::now();
        $startTime = $now->addMinutes(5);

        ExamSession::create([
            'student_id' => $student->id,
            'exam_id' => $exam->id,
            'status' => 'in_progress',
            'start_time' => $startTime,
            'last_synced_at' => $now,
        ]);

        // 3. Act
        $this->actingAs($student);
        $response = $this->getJson('/api/student/active-session');

        // 4. Assert: Remaining time should be capped at full duration (1800s), NOT duration + 5 mins (2100s)
        $response->assertStatus(200);
        $this->assertLessThanOrEqual(1800, $response->json('remaining_seconds'));
        $this->assertGreaterThanOrEqual(1799, $response->json('remaining_seconds'));
    }
}
