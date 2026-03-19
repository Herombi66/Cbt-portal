<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string'],
            'class_name' => ['required', 'string'],
            'question_text' => ['required', 'string'],
            'type' => ['sometimes', 'string', Rule::in(['mcq', 'fib', 'boolean'])],
            'option_a' => ['required_if:type,mcq', 'nullable', 'string'],
            'option_b' => ['required_if:type,mcq', 'nullable', 'string'],
            'option_c' => ['required_if:type,mcq', 'nullable', 'string'],
            'option_d' => ['required_if:type,mcq', 'nullable', 'string'],
            'correct_option' => ['required_if:type,mcq', 'nullable', 'string', Rule::in(['A', 'B', 'C', 'D'])],
            'answer' => ['required_if:type,fib', 'nullable', 'string'],
            'answerBool' => ['required_if:type,boolean', 'nullable', 'boolean'],
        ];
    }
}

