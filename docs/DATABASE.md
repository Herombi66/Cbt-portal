# CBT Portal Database Documentation

This document describes the database schema, relationships, and persistence layer implementation for the CBT Portal.

## 1. Schema Overview

The database is built on **MySQL** (or SQLite for development) and managed via Laravel Migrations.

### Tables

| Table | Description | Key Columns |
|---|---|---|
| `users` | Admin users | `id`, `name`, `email`, `role`, `password` |
| `students` | Students taking exams | `id`, `registration_number`, `name`, `class_name`, `gender` |
| `questions` | Question bank | `id`, `question_text`, `option_a/b/c/d`, `correct_option` |
| `exams` | Exam configurations | `id`, `title`, `duration_minutes`, `starts_at`, `ends_at`, `is_active` |
| `exam_questions` | Pivot: Questions in Exams | `id`, `exam_id`, `question_id`, `sort_order` |
| `exam_results` | Student exam submissions | `id`, `exam_id`, `student_id`, `score`, `total_questions` |
| `exam_answers` | Detailed student answers | `id`, `exam_result_id`, `question_id`, `selected_option`, `is_correct` |

## 2. Relationships

- **Exam ↔ Question**: Many-to-Many via `exam_questions`.
- **Exam ↔ Result**: One-to-Many. An exam can have multiple results.
- **Student ↔ Result**: One-to-Many. A student can have multiple results.
- **Result ↔ Answer**: One-to-Many. A result contains multiple individual answers.

## 3. Persistence & Integrity

- **Transactions**: All multi-step operations (like submitting an exam or assigning questions) are wrapped in `DB::transaction()` to ensure atomicity.
- **Foreign Keys**: `CASCADE ON DELETE` is used where appropriate (e.g., deleting an exam deletes its results and question assignments).
- **Indexing**:
    - `students`: Index on `class_name`.
    - `questions`: Index on `(subject, class_name)`.
    - `exams`: Index on `(is_active, starts_at, ends_at)`.
    - `exam_questions`: Unique on `(exam_id, question_id)`.
- **Validation**:
    - Backend: Laravel Form Requests validate all incoming data before it hits the database.
    - Database: Unique constraints on `email` and `registration_number`.

## 4. Error Handling & Logging

- **Query Logging**: DB query errors are caught by Laravel's global exception handler and logged to `storage/logs/laravel.log`.
- **Rollbacks**: If a transaction fails, Laravel automatically rolls back all changes to maintain data consistency.

## 5. Maintenance

- **Backups**: Standard `mysqldump` or `sqlite3` backup procedures should be followed.
- **Migrations**: Always use `php artisan migrate` to update the schema.
