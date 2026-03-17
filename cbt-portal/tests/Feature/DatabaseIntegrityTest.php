<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that transactions rollback correctly on failure.
     */
    public function test_transaction_rollbacks_on_failure(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test')->plainTextToken;

        $exam = Exam::factory()->create();
        $question = Question::factory()->create();

        // Attempt to assign questions with an invalid payload that will trigger a DB error
        // (e.g., trying to sync a non-existent question ID in a transaction)
        try {
            DB::transaction(function () use ($exam) {
                $exam->questions()->sync([
                    9999 => ['sort_order' => 1] // Non-existent ID should fail if foreign keys are enforced
                ]);
            });
        } catch (\Exception $e) {
            // Expected failure
        }

        // Verify that the exam_questions table is still empty
        $this->assertDatabaseCount('exam_questions', 0);
    }

    /**
     * Test data validation and constraints.
     */
    public function test_data_integrity_constraints(): void
    {
        // Test unique registration number constraint
        \App\Models\Student::factory()->create(['registration_number' => 'STU001']);

        $this->expectException(\Illuminate\Database\QueryException::class);
        \App\Models\Student::factory()->create(['registration_number' => 'STU001']);
    }

    /**
     * Test cascaded deletes.
     */
    public function test_cascaded_deletes(): void
    {
        $exam = Exam::factory()->create();
        $question = Question::factory()->create();
        $exam->questions()->attach($question, ['sort_order' => 1]);

        $this->assertDatabaseHas('exam_questions', ['exam_id' => $exam->id]);

        $exam->delete();

        $this->assertDatabaseMissing('exam_questions', ['exam_id' => $exam->id]);
    }
}
