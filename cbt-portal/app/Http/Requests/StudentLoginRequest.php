<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StudentLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login' => ['sometimes', 'required', 'string'],
            'registration_number' => ['sometimes', 'required', 'string'],
            'password' => ['sometimes', 'nullable', 'string'],
        ];
    }
}

