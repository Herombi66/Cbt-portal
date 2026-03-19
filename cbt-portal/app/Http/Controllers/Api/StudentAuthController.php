<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StudentLoginRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class StudentAuthController extends Controller
{
    public function login(StudentLoginRequest $request): JsonResponse
    {
        $login = $request->validated('login') ?? $request->validated('registration_number');
        $password = $request->validated('password') ?? 'password123';

        $student = Student::query()
            ->where('registration_number', 'LIKE', $login)
            ->orWhere('email', 'LIKE', $login)
            ->first();

        if ($student === null || ! Hash::check($password, $student->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        if (!$student->is_active) {
            return response()->json(['message' => 'Your account is deactivated.'], 403);
        }

        // Force logout from other devices
        $student->tokens()->delete();

        $token = $student->createToken('student-token', ['student'])->plainTextToken;

        return (new StudentResource($student))
            ->additional(['token' => $token])
            ->response();
    }

    public function logout(): JsonResponse
    {
        $student = request()->user();

        if ($student !== null && method_exists($student, 'currentAccessToken')) {
            $student->currentAccessToken()?->delete();
        }

        return response()->json(['message' => 'Logged out.']);
    }
}

