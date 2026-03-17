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
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ExamController extends Controller
{
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
                    $q->whereNull('class_name')->orWhere('class_name', $student->class_name);
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
            ->get(); // Use get() instead of paginate for student portal list

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
                $isCorrect = strtoupper($selected) === strtoupper((string) $question->correct_option);

                if ($isCorrect) {
                    $score++;
                }

                ExamAnswer::query()->create([
                    'exam_result_id' => $result->id,
                    'question_id' => $question->id,
                    'selected_option' => strtoupper($selected),
                    'is_correct' => $isCorrect,
                ]);
            }

            $result->score = $score;
            $result->save();

            return $result->load(['exam', 'answers']);
        });

        return (new ExamResultResource($result))
            ->response();
    }
}

