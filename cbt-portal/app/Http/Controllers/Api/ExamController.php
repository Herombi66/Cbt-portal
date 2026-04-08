<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitExamRequest;
use App\Http\Resources\ExamDetailResource;
use App\Http\Resources\ExamResource;
use App\Http\Resources\ExamResultResource;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamResult;
use App\Models\Student;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\ExamSession;
use Carbon\Carbon;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ExamController extends Controller
{
    public function startSession(Request $request, Exam $exam): JsonResponse
    {
        $now = CarbonImmutable::now();
        if (! $this->examIsActive($exam, $now)) {
            return response()->json(['message' => 'Exam is not available.'], 422);
        }

        /** @var Student $student */
        $student = $request->user();

        // Check if already completed or result exists
        $hasResult = ExamResult::query()
            ->where('student_id', $student->id)
            ->where('exam_id', $exam->id)
            ->exists();

        $session = ExamSession::query()
            ->where('student_id', $student->id)
            ->where('exam_id', $exam->id)
            ->first();

        if ($hasResult || ($session && $session->status === 'completed')) {
            return response()->json(['message' => 'Exam already completed.'], 422);
        }

        if (! $session) {
            $session = ExamSession::query()->create([
                'student_id' => $student->id,
                'exam_id' => $exam->id,
                'status' => 'in_progress',
                'start_time' => $now,
                'last_synced_at' => $now,
                'current_question_index' => 0,
                'answers_provided' => [],
            ]);
        }

        $durationSeconds = $exam->duration_minutes * 60;
        $elapsedSeconds = $session->start_time->diffInSeconds($now, false);
        // Ensure elapsedSeconds is at least 0 (case of server time drift or timezone mismatch)
        $elapsedSeconds = max(0, $elapsedSeconds);
        $remainingSeconds = max(0, $durationSeconds - $elapsedSeconds);

        return response()->json([
            'session' => $session,
            'remaining_seconds' => $remainingSeconds,
        ]);
    }

    public function syncSession(Request $request, Exam $exam): JsonResponse
    {
        /** @var Student $student */
        $student = $request->user();

        $session = ExamSession::query()
            ->where('student_id', $student->id)
            ->where('exam_id', $exam->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $session->update([
            'current_question_index' => $request->integer('current_question_index'),
            'answers_provided' => $request->input('answers_provided'),
            'last_synced_at' => CarbonImmutable::now(),
        ]);

        return response()->json(['message' => 'Synced.']);
    }

    public function checkActiveSession(Request $request): JsonResponse
    {
        /** @var Student $student */
        $student = $request->user();

        $session = ExamSession::query()
            ->with('exam')
            ->where('student_id', $student->id)
            ->where('status', 'in_progress')
            ->first();

        if ($session) {
            $now = CarbonImmutable::now();
            $durationSeconds = $session->exam->duration_minutes * 60;
            $elapsedSeconds = $session->start_time->diffInSeconds($now, false);
            // Ensure elapsedSeconds is at least 0 (case of server time drift or timezone mismatch)
            $elapsedSeconds = max(0, $elapsedSeconds);
            $remainingSeconds = max(0, $durationSeconds - $elapsedSeconds);

            if ($remainingSeconds <= 0) {
                // Session expired, mark as completed but don't auto-submit result here
                // Client should handle the transition
                $session->update(['status' => 'completed']);
                return response()->json(['session' => null]);
            }

            return response()->json([
                'session' => $session,
                'remaining_seconds' => $remainingSeconds,
            ]);
        }

        return response()->json(['session' => null]);
    }

    private function examIsActive(Exam $exam, CarbonImmutable $now): bool
    {
        if (! $exam->is_active) {
            return false;
        }

        if ($exam->starts_at !== null && $exam->starts_at->greaterThan($now)) {
            return false;
        }

        if ($exam->ends_at !== null && $exam->ends_at->lessThan($now)) {
            return false;
        }

        return true;
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $now = CarbonImmutable::now();
        /** @var Student $student */
        $student = $request->user();

        $exams = Exam::query()
            ->where('is_active', true)
            ->where(function ($q) use ($student): void {
                if ($student && $student->class_name) {
                    $class = trim((string) $student->class_name);
                    $q->where(function ($sq) use ($class): void {
                        $sq->whereNull('class_name')
                           ->orWhere('class_name', '')
                           ->orWhere('class_name', 'LIKE', $class);
                    });
                } else {
                    $q->whereNull('class_name')->orWhere('class_name', '');
                }
            })
            ->where(function ($q) use ($now): void {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->withCount('questions')
            ->latest()
            ->get();

        return ExamResource::collection($exams);
    }

    public function show(Exam $exam): ExamDetailResource
    {
        $now = CarbonImmutable::now();
        if (! $this->examIsActive($exam, $now)) {
            abort(404);
        }

        $exam->load(['questions']);

        return new ExamDetailResource($exam);
    }

    public function submit(SubmitExamRequest $request, Exam $exam): JsonResponse
    {
        $now = CarbonImmutable::now();
        if (! $this->examIsActive($exam, $now)) {
            return response()->json(['message' => 'Exam is not available.'], 422);
        }

        /** @var Student $student */
        $student = $request->user();

        $existing = ExamResult::query()
            ->where('exam_id', $exam->id)
            ->where('student_id', $student->id)
            ->first();

        if ($existing !== null) {
            return response()->json(['message' => 'Exam already submitted.'], 409);
        }

        $exam->load('questions');
        if ($exam->questions->isEmpty()) {
            return response()->json(['message' => 'Exam has no questions assigned.'], 422);
        }

        $answers = $request->validated('answers');
        $answersByQuestionId = [];
        foreach ($answers as $answer) {
            $answersByQuestionId[(int) $answer['question_id']] = (string) $answer['selected_option'];
        }

        $questionIds = $exam->questions->pluck('id')->map(fn ($id) => (int) $id)->all();
        $invalid = array_diff(array_keys($answersByQuestionId), $questionIds);
        if ($invalid !== []) {
            return response()->json(['message' => 'Invalid question(s) in submission.'], 422);
        }

        $missing = array_diff($questionIds, array_keys($answersByQuestionId));
        if ($missing !== []) {
            return response()->json(['message' => 'Missing answer(s) for some questions.'], 422);
        }

        $result = DB::transaction(function () use ($exam, $student, $answersByQuestionId, $now): ExamResult {
            $score = 0;

            $result = ExamResult::query()->create([
                'exam_id' => $exam->id,
                'student_id' => $student->id,
                'score' => 0,
                'total_questions' => $exam->questions->count(),
                'submitted_at' => $now,
            ]);

            foreach ($exam->questions as $question) {
                $selected = $answersByQuestionId[(int) $question->id] ?? '';
                $isCorrect = false;

                if ($question->type === 'fib') {
                    $isCorrect = trim(strtolower((string) $selected)) === trim(strtolower((string) $question->answer));
                } elseif ($question->type === 'boolean') {
                    $val = strtoupper(trim((string) $selected));
                    if ($val === 'A') {
                        $isCorrect = (bool) $question->answerBool;
                    } elseif ($val === 'B') {
                        $isCorrect = ! ((bool) $question->answerBool);
                    }
                } else {
                    // Default to MCQ
                    $isCorrect = strtoupper((string) $selected) === strtoupper((string) $question->correct_option);
                }

                if ($isCorrect) {
                    $score++;
                }

                ExamAnswer::query()->create([
                    'exam_result_id' => $result->id,
                    'question_id' => $question->id,
                    'selected_option' => substr(strtoupper((string) $selected), 0, 255),
                    'is_correct' => $isCorrect,
                ]);
            }

            $result->score = $score;
            $result->save();

            // Mark session as completed
            ExamSession::query()
                ->where('student_id', $student->id)
                ->where('exam_id', $exam->id)
                ->where('status', 'in_progress')
                ->update(['status' => 'completed']);

            return $result->load(['exam', 'answers']);
        });

        return (new ExamResultResource($result))
            ->response();
    }
}

