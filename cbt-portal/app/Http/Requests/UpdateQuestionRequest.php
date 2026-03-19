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
            'subject' => ['sometimes', 'required', 'string'],
            'class_name' => ['sometimes', 'required', 'string'],
            'question_text' => ['sometimes', 'required', 'string'],
            'type' => ['sometimes', 'string', Rule::in(['mcq', 'fib', 'boolean'])],
            'option_a' => ['sometimes', 'required_if:type,mcq', 'nullable', 'string'],
            'option_b' => ['sometimes', 'required_if:type,mcq', 'nullable', 'string'],
            'option_c' => ['sometimes', 'required_if:type,mcq', 'nullable', 'string'],
            'option_d' => ['sometimes', 'required_if:type,mcq', 'nullable', 'string'],
            'correct_option' => ['sometimes', 'required_if:type,mcq', 'nullable', 'string', Rule::in(['A', 'B', 'C', 'D'])],
            'answer' => ['sometimes', 'required_if:type,fib', 'nullable', 'string'],
            'answerBool' => ['sometimes', 'required_if:type,boolean', 'nullable', 'boolean'],
        ];
    }
}

