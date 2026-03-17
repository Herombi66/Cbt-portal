<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamResultResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $total = (int) $this->resource->total_questions;
        $score = (int) $this->resource->score;

        return [
            'id' => $this->resource->id,
            'exam_id' => $this->resource->exam_id,
            'student_id' => $this->resource->student_id,
            'score' => $score,
            'total_questions' => $total,
            'percentage' => $total > 0 ? round(($score / $total) * 100, 2) : 0.0,
            'submitted_at' => $this->resource->submitted_at,
            'created_at' => $this->resource->created_at,
        ];
    }
}

