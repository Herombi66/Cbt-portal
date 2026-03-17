<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'question_text' => ['sometimes', 'required', 'string'],
            'option_a' => ['sometimes', 'required', 'string'],
            'option_b' => ['sometimes', 'required', 'string'],
            'option_c' => ['sometimes', 'required', 'string'],
            'option_d' => ['sometimes', 'required', 'string'],
            'correct_option' => ['sometimes', 'required', 'string', Rule::in(['A', 'B', 'C', 'D'])],
        ];
    }
}

