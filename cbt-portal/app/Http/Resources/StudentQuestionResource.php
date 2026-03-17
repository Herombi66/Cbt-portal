<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'question_text' => $this->resource->question_text,
            'option_a' => $this->resource->option_a,
            'option_b' => $this->resource->option_b,
            'option_c' => $this->resource->option_c,
            'option_d' => $this->resource->option_d,
            'sort_order' => $this->resource->pivot?->sort_order,
        ];
    }
}

