<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'duration_minutes' => $this->resource->duration_minutes,
            'starts_at' => $this->resource->starts_at,
            'ends_at' => $this->resource->ends_at,
            'is_active' => (bool) $this->resource->is_active,
            'questions' => StudentQuestionResource::collection($this->whenLoaded('questions')),
        ];
    }
}

