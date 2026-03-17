<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignExamQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.question_id' => ['required', 'integer', 'exists:questions,id'],
            'questions.*.sort_order' => ['required', 'integer', 'min:0'],
        ];
    }
}

