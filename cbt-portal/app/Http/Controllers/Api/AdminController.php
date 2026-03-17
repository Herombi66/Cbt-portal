<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignExamQuestionsRequest;
use App\Http\Requests\StoreExamRequest;
use App\Http\Requests\StoreQuestionRequest;
use App\Http\Requests\UpdateExamRequest;
use App\Http\Requests\UpdateQuestionRequest;
use App\Http\Resources\AdminQuestionResource;
use App\Http\Resources\ExamResource;
use App\Models\Exam;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function questionsIndex(): AnonymousResourceCollection
    {
        return AdminQuestionResource::collection(Question::query()->latest()->paginate(50));
    }

    public function questionsStore(StoreQuestionRequest $request): JsonResponse
    {
        $question = Question::query()->create($request->validated());

        return (new AdminQuestionResource($question))
            ->response()
            ->setStatusCode(201);
    }

    public function questionsShow(Question $question): AdminQuestionResource
    {
        return new AdminQuestionResource($question);
    }

    public function questionsUpdate(UpdateQuestionRequest $request, Question $question): AdminQuestionResource
    {
        $question->fill($request->validated());
        $question->save();

        return new AdminQuestionResource($question);
    }

    public function questionsDestroy(Question $question): JsonResponse
    {
        $question->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function examsIndex(): AnonymousResourceCollection
    {
        return ExamResource::collection(Exam::query()->latest()->paginate(50));
    }

    public function examsStore(StoreExamRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $exam = Exam::query()->create($request->validated());

            return (new ExamResource($exam))
                ->response()
                ->setStatusCode(201);
        });
    }

    public function examsShow(Exam $exam): ExamResource
    {
        $exam->loadCount('questions');

        return new ExamResource($exam);
    }

    public function examsUpdate(UpdateExamRequest $request, Exam $exam): ExamResource
    {
        DB::transaction(function () use ($request, $exam) {
            $exam->fill($request->validated());
            $exam->save();
        });

        return new ExamResource($exam);
    }

    public function examsDestroy(Exam $exam): JsonResponse
    {
        $exam->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function assignQuestions(AssignExamQuestionsRequest $request, Exam $exam): ExamResource
    {
        $items = $request->validated('questions');

        $syncData = [];
        foreach ($items as $item) {
            $syncData[(int) $item['question_id']] = ['sort_order' => (int) $item['sort_order']];
        }

        DB::transaction(function () use ($exam, $syncData): void {
            $exam->questions()->sync($syncData);
        });

        $exam->loadCount('questions');

        return new ExamResource($exam);
    }

    public function studentsIndex(): JsonResponse
    {
        return response()->json(['data' => \App\Models\Student::query()->latest()->get()]);
    }

    public function studentsStore(\Illuminate\Http\Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:students',
            'registration_number' => 'required|string|unique:students',
            'password' => 'required|string|min:6',
            'class_name' => 'nullable|string',
            'gender' => 'nullable|string',
        ]);

        $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        $student = \App\Models\Student::query()->create($validated);

        return response()->json(['data' => new \App\Http\Resources\StudentResource($student)], 201);
    }

    public function studentsUpdate(\Illuminate\Http\Request $request, \App\Models\Student $student): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string',
            'email' => 'email|unique:students,email,' . $student->id,
            'registration_number' => 'string|unique:students,registration_number,' . $student->id,
            'password' => 'nullable|string|min:6',
            'class_name' => 'nullable|string',
            'gender' => 'nullable|string',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        }

        $student->update($validated);

        return response()->json(['data' => new \App\Http\Resources\StudentResource($student)]);
    }

    public function studentsDestroy(\App\Models\Student $student): JsonResponse
    {
        $student->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function usersIndex(): JsonResponse
    {
        return response()->json(['data' => \App\Models\User::query()->latest()->get()]);
    }

    public function usersStore(\Illuminate\Http\Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users',
            'role' => 'required|string|in:admin,super_admin',
            'password' => 'required|string|min:6',
        ]);

        $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        $user = \App\Models\User::query()->create($validated);

        return response()->json(['data' => $user], 201);
    }

    public function usersUpdate(\Illuminate\Http\Request $request, \App\Models\User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string',
            'email' => 'email|unique:users,email,' . $user->id,
            'role' => 'string|in:admin,super_admin',
            'password' => 'nullable|string|min:6',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json(['data' => $user]);
    }

    public function usersDestroy(\App\Models\User $user): JsonResponse
    {
        if ($user->role === 'super_admin' && \App\Models\User::where('role', 'super_admin')->count() <= 1) {
            return response()->json(['message' => 'Cannot delete the last super admin.'], 403);
        }
        $user->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function resultsIndex(): JsonResponse
    {
        return response()->json(['data' => \App\Models\ExamResult::query()->latest()->get()]);
    }

    public function getSystemSettings(): JsonResponse
    {
        $settings = \App\Models\SystemSetting::all()->pluck('value', 'key');
        
        // Check if all accounts are active
        $allActive = !\App\Models\User::where('is_active', false)->exists() && 
                     !\App\Models\Student::where('is_active', false)->exists();
        
        return response()->json([
            'settings' => $settings,
            'global_active' => $allActive
        ]);
    }

    public function updateSystemSettings(\Illuminate\Http\Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scheduled_shutdown' => 'nullable|date',
        ]);

        foreach ($validated as $key => $value) {
            \App\Models\SystemSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        return response()->json(['message' => 'Settings updated.']);
    }

    public function toggleGlobalStatus(\Illuminate\Http\Request $request): JsonResponse
    {
        $request->validate(['active' => 'required|boolean']);
        $active = $request->boolean('active');

        DB::transaction(function () use ($active) {
            // Deactivate/Activate all students
            \App\Models\Student::query()->update(['is_active' => $active]);

            // Deactivate/Activate all regular admins
            \App\Models\User::where('role', '!=', 'super_admin')->update(['is_active' => $active]);
            
            // If deactivating, revoke tokens for everyone EXCEPT super_admins
            if (!$active) {
                // Students
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', \App\Models\Student::class)
                    ->delete();
                
                // Regular Admins
                $regularAdminIds = \App\Models\User::where('role', '!=', 'super_admin')->pluck('id');
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', \App\Models\User::class)
                    ->whereIn('tokenable_id', $regularAdminIds)
                    ->delete();
            }
        });

        return response()->json(['message' => $active ? 'All accounts activated.' : 'All accounts deactivated.']);
    }
}

