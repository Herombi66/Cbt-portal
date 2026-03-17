<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('students')) {
            Schema::create('students', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('registration_number')->nullable()->unique();
                $table->string('password');
                $table->string('class_name')->nullable();
                $table->string('gender')->nullable();
                $table->boolean('is_active')->default(true);
                $table->rememberToken();
                $table->timestamps();

                $table->index('class_name');
            });
        }

        if (! Schema::hasTable('questions')) {
            Schema::create('questions', function (Blueprint $table) {
                $table->id();
                $table->string('subject')->nullable();
                $table->string('class_name')->nullable();
                $table->text('question_text');
                $table->string('option_a');
                $table->string('option_b');
                $table->string('option_c');
                $table->string('option_d');
                $table->string('correct_option', 1);
                $table->timestamps();

                $table->index(['subject', 'class_name']);
            });
        }

        if (! Schema::hasTable('exams')) {
            Schema::create('exams', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('subject')->nullable();
                $table->string('class_name')->nullable();
                $table->text('description')->nullable();
                $table->unsignedInteger('duration_minutes')->default(0);
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['is_active', 'starts_at', 'ends_at']);
                $table->index(['subject', 'class_name']);
            });
        }

        if (! Schema::hasTable('exam_questions')) {
            Schema::create('exam_questions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->unique(['exam_id', 'question_id']);
                $table->index(['exam_id', 'sort_order']);
            });
        }

        if (! Schema::hasTable('exam_results')) {
            Schema::create('exam_results', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->unsignedInteger('score')->default(0);
                $table->unsignedInteger('total_questions')->default(0);
                $table->timestamp('submitted_at')->nullable();
                $table->timestamps();

                $table->index(['student_id', 'exam_id']);
            });
        }

        if (! Schema::hasTable('exam_answers')) {
            Schema::create('exam_answers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_result_id')->constrained('exam_results')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
                $table->string('selected_option', 1);
                $table->boolean('is_correct')->default(false);
                $table->timestamps();

                $table->unique(['exam_result_id', 'question_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_answers');
        Schema::dropIfExists('exam_results');
        Schema::dropIfExists('exam_questions');
        Schema::dropIfExists('exams');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('students');
    }
};

