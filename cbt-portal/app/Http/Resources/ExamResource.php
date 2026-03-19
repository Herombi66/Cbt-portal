<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'title' => $this->resource->title,
            'subject' => $this->resource->subject,
            'class_name' => $this->resource->class_name,
            'description' => $this->resource->description,
            'duration_minutes' => $this->resource->duration_minutes,
            'starts_at' => $this->resource->starts_at,
            'ends_at' => $this->resource->ends_at,
            'is_active' => (bool) $this->resource->is_active,
            'questions_count' => $this->resource->questions_count,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}

