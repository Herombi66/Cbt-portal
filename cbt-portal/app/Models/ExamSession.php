<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamSession extends Model
{
    protected $fillable = [
        'student_id',
        'exam_id',
        'current_question_index',
        'answers_provided',
        'start_time',
        'last_synced_at',
        'status',
    ];

    protected $casts = [
        'answers_provided' => 'array',
        'start_time' => 'datetime',
        'last_synced_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }
}
