<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\StudentAuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ExamController;

Route::prefix('admin')->group(function (): void {
    Route::post('login', [AdminAuthController::class, 'login']);

    Route::middleware(['auth:sanctum', 'active', 'role:super_admin,admin'])->group(function (): void {
        Route::post('logout', [AdminAuthController::class, 'logout']);

        Route::get('questions', [AdminController::class, 'questionsIndex']);
        Route::post('questions', [AdminController::class, 'questionsStore']);
        Route::post('questions/bulk', [AdminController::class, 'questionsBulkStore']);
        Route::delete('questions/bulk', [AdminController::class, 'questionsBulkDestroy']);
        Route::get('questions/{question}', [AdminController::class, 'questionsShow']);
        Route::put('questions/{question}', [AdminController::class, 'questionsUpdate']);
        Route::patch('questions/{question}', [AdminController::class, 'questionsUpdate']);
        Route::delete('questions/{question}', [AdminController::class, 'questionsDestroy']);

        Route::get('exams', [AdminController::class, 'examsIndex']);
        Route::post('exams', [AdminController::class, 'examsStore']);
        Route::delete('exams/bulk', [AdminController::class, 'examsBulkDestroy']);
        Route::post('exams/bulk-status', [AdminController::class, 'examsBulkStatus']);
        Route::get('exams/{exam}', [AdminController::class, 'examsShow']);
        Route::put('exams/{exam}', [AdminController::class, 'examsUpdate']);
        Route::patch('exams/{exam}', [AdminController::class, 'examsUpdate']);
        Route::delete('exams/{exam}', [AdminController::class, 'examsDestroy']);

        Route::post('exams/{exam}/assign-questions', [AdminController::class, 'assignQuestions']);

        Route::get('students', [AdminController::class, 'studentsIndex']);
        Route::post('students', [AdminController::class, 'studentsStore']);
        Route::post('students/bulk', [AdminController::class, 'studentsBulkStore']);
        Route::delete('students/bulk', [AdminController::class, 'studentsBulkDestroy']);
        Route::post('students/bulk-status', [AdminController::class, 'studentsBulkStatus']);
        Route::put('students/{student}', [AdminController::class, 'studentsUpdate']);
        Route::delete('students/{student}', [AdminController::class, 'studentsDestroy']);

        Route::get('results', [AdminController::class, 'resultsIndex']);
        Route::delete('results/{result}', [AdminController::class, 'resultsDestroy']);
        Route::get('active-sessions', [AdminController::class, 'activeSessions']);

        Route::middleware(['role:super_admin'])->group(function (): void {
            Route::get('system-settings', [AdminController::class, 'getSystemSettings']);
            Route::post('system-settings', [AdminController::class, 'updateSystemSettings']);
            Route::post('toggle-global-status', [AdminController::class, 'toggleGlobalStatus']);

            Route::get('users', [AdminController::class, 'usersIndex']);
            Route::post('users', [AdminController::class, 'usersStore']);
            Route::put('users/{user}', [AdminController::class, 'usersUpdate']);
            Route::delete('users/{user}', [AdminController::class, 'usersDestroy']);
        });
    });
});

Route::prefix('student')->group(function (): void {
    Route::post('login', [StudentAuthController::class, 'login']);

    Route::middleware(['auth:students', 'active'])->group(function (): void {
        Route::post('logout', [StudentAuthController::class, 'logout']);

        Route::get('exams', [ExamController::class, 'index']);
        Route::get('active-session', [ExamController::class, 'checkActiveSession']);
        Route::get('exams/{exam}', [ExamController::class, 'show']);
        Route::post('exams/{exam}/start-session', [ExamController::class, 'startSession']);
        Route::post('exams/{exam}/sync-session', [ExamController::class, 'syncSession']);
        Route::post('exams/{exam}/submit', [ExamController::class, 'submit']);
    });
});
