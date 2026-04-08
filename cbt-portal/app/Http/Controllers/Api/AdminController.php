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
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function questionsIndex(): AnonymousResourceCollection
    {
        // For admin dashboard, we might want to see all questions or at least more than 50
        // Let's use a higher limit for now or allow a 'per_page' parameter
        $perPage = request()->integer('per_page', 1000);

        $query = Question::query();

        if (request()->has('class_name') && request('class_name') !== 'all') {
            $query->where('class_name', request('class_name'));
        }

        if (request()->has('subject') && request('subject') !== 'all') {
            $query->where('subject', request('subject'));
        }

        return AdminQuestionResource::collection($query->latest()->paginate($perPage));
    }

    public function questionsStore(StoreQuestionRequest $request): JsonResponse
    {
        $question = Question::query()->create($request->validated());

        return (new AdminQuestionResource($question))
            ->response()
            ->setStatusCode(201);
    }

    public function questionsBulkStore(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'questions' => ['required', 'array'],
                'questions.*.subject' => ['required', 'string'],
                'questions.*.class_name' => ['required', 'string'],
                'questions.*.question_text' => ['required', 'string'],
                'questions.*.type' => ['sometimes', 'string', 'in:mcq,fib,boolean'],
                'questions.*.option_a' => ['required_if:questions.*.type,mcq', 'nullable', 'string'],
                'questions.*.option_b' => ['required_if:questions.*.type,mcq', 'nullable', 'string'],
                'questions.*.option_c' => ['required_if:questions.*.type,mcq', 'nullable', 'string'],
                'questions.*.option_d' => ['required_if:questions.*.type,mcq', 'nullable', 'string'],
                'questions.*.correct_option' => ['required_if:questions.*.type,mcq', 'nullable', 'string', 'in:A,B,C,D'],
                'questions.*.answer' => ['required_if:questions.*.type,fib', 'nullable', 'string'],
                'questions.*.answerBool' => ['required_if:questions.*.type,boolean', 'nullable', 'boolean'],
            ]);

            $created = [];
            DB::beginTransaction();
            try {
                foreach ($data['questions'] as $index => $qData) {
                    $created[] = Question::query()->create($qData);
                }
                DB::commit();
                \Illuminate\Support\Facades\Log::info("Bulk import successful: " . count($created) . " questions created.");
            } catch (\Exception $e) {
                DB::rollBack();
                \Illuminate\Support\Facades\Log::error("Bulk import failed during creation: " . $e->getMessage(), [
                    'exception' => $e,
                    'data_sample' => array_slice($data['questions'], 0, 5)
                ]);
                throw $e;
            }

            return response()->json([
                'message' => count($created) . ' questions imported successfully.',
                'data' => AdminQuestionResource::collection($created)
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::warning("Bulk import validation failed: " . json_encode($e->errors()));
            return response()->json([
                'message' => 'Validation failed for some questions.',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Bulk import critical error: " . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred during bulk import.',
                'error' => $e->getMessage()
            ], 500);
        }
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

    public function questionsBulkDestroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'exists:questions,id'],
        ]);

        $count = 0;
        DB::transaction(function () use ($data, &$count) {
            $count = Question::query()->whereIn('id', $data['ids'])->delete();
        });

        return response()->json([
            'message' => "$count questions deleted successfully."
        ]);
    }

    public function examsIndex(): AnonymousResourceCollection
    {
        $perPage = request()->integer('per_page', 1000);
        return ExamResource::collection(Exam::query()->latest()->paginate($perPage));
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

    public function examsBulkDestroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'exists:exams,id'],
        ]);

        $count = 0;
        DB::transaction(function () use ($data, &$count, $request) {
            $count = Exam::query()->whereIn('id', $data['ids'])->delete();
            \Illuminate\Support\Facades\Log::info("Bulk exam deletion by admin (" . $request->user()->email . "): " . count($data['ids']) . " exams deleted.");
        });

        return response()->json([
            'message' => "$count exams deleted successfully."
        ]);
    }

    public function examsBulkStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'exists:exams,id'],
            'is_active' => ['required', 'boolean'],
        ]);

        $count = 0;
        DB::transaction(function () use ($data, &$count, $request) {
            $count = Exam::query()->whereIn('id', $data['ids'])->update(['is_active' => $data['is_active']]);
            $action = $data['is_active'] ? 'activated' : 'deactivated';
            \Illuminate\Support\Facades\Log::info("Bulk exam status update ($action) by admin (" . $request->user()->email . "): " . count($data['ids']) . " exams updated.");
        });

        return response()->json([
            'message' => "$count exams updated successfully."
        ]);
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

    public function studentsIndex(): AnonymousResourceCollection
    {
        $perPage = request()->integer('per_page', 1000);
        return \App\Http\Resources\StudentResource::collection(\App\Models\Student::query()->latest()->paginate($perPage));
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
        if (isset($validated['class_name'])) {
            $validated['class_name'] = trim((string) $validated['class_name']);
        }
        $student = \App\Models\Student::query()->create($validated);

        return response()->json(['data' => new \App\Http\Resources\StudentResource($student)], 201);
    }

    public function studentsBulkStore(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'students' => ['required', 'array'],
                'students.*.name' => ['required', 'string'],
                'students.*.email' => ['required', 'email'],
                'students.*.registration_number' => ['required', 'string'],
                'students.*.password' => ['required', 'string', 'min:6'],
                'students.*.class_name' => ['nullable', 'string'],
                'students.*.gender' => ['nullable', 'string'],
            ]);

            $studentsData = $data['students'];
            $emails = array_map(fn($e) => strtolower((string)$e), array_column($studentsData, 'email'));
            $regNumbers = array_map(fn($r) => strtolower((string)$r), array_column($studentsData, 'registration_number'));

            // 1. Bulk check for existing records in DB (case-insensitive)
            $existingEmails = \App\Models\Student::whereIn(\DB::raw('LOWER(email)'), $emails)->pluck('email')->map(fn($e) => strtolower((string)$e))->toArray();
            $existingRegs = \App\Models\Student::whereIn(\DB::raw('LOWER(registration_number)'), $regNumbers)->pluck('registration_number')->map(fn($r) => strtolower((string)$r))->toArray();

            $toInsert = [];
            $errors = [];
            $inputEmails = []; // Track lowercase emails for batch uniqueness
            $inputRegs = [];   // Track lowercase reg numbers for batch uniqueness
            $inputRegsOrig = []; // Track original reg numbers for retrieval
            $passwordCache = [];
            $now = now();
            
            foreach ($studentsData as $idx => $sData) {
                $email = trim((string) $sData['email']);
                $reg = trim((string) $sData['registration_number']);
                $emailLower = strtolower($email);
                $regLower = strtolower($reg);
                $rowErrors = [];

                // Check uniqueness in DB
                if (in_array($emailLower, $existingEmails)) {
                    $rowErrors[] = "The email '{$email}' has already been taken.";
                }
                if (in_array($regLower, $existingRegs)) {
                    $rowErrors[] = "The registration number '{$reg}' has already been taken.";
                }
                
                // Check uniqueness in input (to avoid duplicates within the same batch)
                if (in_array($emailLower, $inputEmails)) {
                    $rowErrors[] = "Duplicate email '{$email}' in upload batch.";
                }
                if (in_array($regLower, $inputRegs)) {
                    $rowErrors[] = "Duplicate registration number '{$reg}' in upload batch.";
                }

                if (!empty($rowErrors)) {
                    $errors["students.{$idx}"] = $rowErrors;
                    continue;
                }

                // Add to input trackers to check for duplicates in subsequent rows
                $inputEmails[] = $emailLower;
                $inputRegs[] = $regLower;
                $inputRegsOrig[] = $reg;

                // Optimized Hashing: Cache the hash for same passwords (very common in bulk uploads)
                $pass = (string) $sData['password'];
                if (!isset($passwordCache[$pass])) {
                    $passwordCache[$pass] = \Illuminate\Support\Facades\Hash::make($pass);
                }

                $toInsert[] = [
                    'name' => trim((string) $sData['name']),
                    'email' => $email,
                    'registration_number' => $reg,
                    'password' => $passwordCache[$pass],
                    'class_name' => isset($sData['class_name']) ? trim((string) $sData['class_name']) : null,
                    'gender' => $sData['gender'] ?? null,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // 2. Perform Bulk Insert
            if (!empty($toInsert)) {
                // Chunking to stay within database query limits (e.g., 500 records at a time)
                foreach (array_chunk($toInsert, 500) as $chunk) {
                    \App\Models\Student::query()->insert($chunk);
                }
                \Illuminate\Support\Facades\Log::info("Bulk student registration: " . count($toInsert) . " created, " . count($errors) . " errors.");
            }

            // 3. Retrieve the created models to return them in the response (UI expects this)
            $created = [];
            if (!empty($inputRegsOrig)) {
                $created = \App\Models\Student::whereIn('registration_number', $inputRegsOrig)->latest()->get();
            }

            $status = count($errors) > 0 ? 207 : 201;

            return response()->json([
                 'message' => count($toInsert) . ' students registered successfully.' . (count($errors) > 0 ? ' Some records failed.' : ''),
                 'data' => \App\Http\Resources\StudentResource::collection($created),
                 'errors' => count($errors) > 0 ? $errors : null
             ], $status);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::warning("Bulk student registration validation failed: " . json_encode($e->errors()));
            return response()->json([
                'message' => 'Validation failed for the request structure.',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Bulk student registration critical error: " . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred during bulk registration.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function studentsBulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'exists:students,id']
        ]);

        \App\Models\Student::whereIn('id', $validated['ids'])->delete();

        return response()->json(['message' => 'Selected students deleted.']);
    }

    public function studentsBulkStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'exists:students,id'],
            'is_active' => ['required', 'boolean']
        ]);

        \App\Models\Student::whereIn('id', $validated['ids'])->update(['is_active' => $validated['is_active']]);

        return response()->json(['message' => 'Selected students updated.']);
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

        if (isset($validated['class_name'])) {
            $validated['class_name'] = trim((string) $validated['class_name']);
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
        return response()->json(['data' => \App\Models\ExamResult::query()->with('answers')->latest()->get()]);
    }

    public function resultsDestroy(\App\Models\ExamResult $result): JsonResponse
    {
        $result->delete();
        return response()->json(['message' => 'Result deleted.']);
    }

    public function activeSessions(): JsonResponse
    {
        $sessions = \App\Models\ExamSession::query()
            ->with(['student', 'exam'])
            ->where('status', 'in_progress')
            ->where('last_synced_at', '>=', now()->subMinutes(10)) // Only recent activity
            ->get();

        return response()->json(['data' => $sessions]);
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

