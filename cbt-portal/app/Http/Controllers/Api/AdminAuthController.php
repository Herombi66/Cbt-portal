<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminLoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\JsonResponse;

class AdminAuthController extends Controller
{
    public function login(AdminLoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->validated('email'))->first();

        if ($user === null || ! Hash::check($request->validated('password'), $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Your account is deactivated.'], 403);
        }

        if (! in_array((string) $user->role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $token = $user->createToken('admin-token', ['admin'])->plainTextToken;

        return (new UserResource($user))
            ->additional(['token' => $token])
            ->response();
    }

    public function logout(): JsonResponse
    {
        $user = request()->user();

        if ($user !== null && method_exists($user, 'currentAccessToken')) {
            $user->currentAccessToken()?->delete();
        }

        return response()->json(['message' => 'Logged out.']);
    }
}

