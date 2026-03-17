-- =============================================================================
--  CBT EXAMINATION PORTAL — Database Schema
--  Compatible with: MySQL 8+ / MariaDB 10.6+ / PostgreSQL 14+
--  Generated for: Laravel (with standard timestamp columns)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Drop tables in reverse dependency order (safe re-run)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS exam_answers;
DROP TABLE IF EXISTS exam_results;
DROP TABLE IF EXISTS exam_questions;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;


-- =============================================================================
-- 1. USERS  (admin accounts)
-- =============================================================================
CREATE TABLE users (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)    NOT NULL,
    email            VARCHAR(150)    NOT NULL,
    password         VARCHAR(255)    NOT NULL,
    role             ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin',
    remember_token   VARCHAR(100)    DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. STUDENTS
-- =============================================================================
CREATE TABLE students (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reg_number       VARCHAR(50)     NOT NULL,
    full_name        VARCHAR(150)    NOT NULL,
    class_name       VARCHAR(30)     NOT NULL,
    email            VARCHAR(150)    DEFAULT NULL,
    gender           ENUM('Male', 'Female') DEFAULT NULL,
    is_active        TINYINT(1)      NOT NULL DEFAULT 1,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_students_reg_number (reg_number),
    UNIQUE KEY uq_students_email      (email),
    KEY idx_students_class            (class_name),
    KEY idx_students_active           (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 3. QUESTIONS  (question bank)
-- =============================================================================
CREATE TABLE questions (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    subject          VARCHAR(100)    NOT NULL,
    class_name       VARCHAR(30)     NOT NULL,
    question_text    TEXT            NOT NULL,
    option_a         VARCHAR(500)    NOT NULL,
    option_b         VARCHAR(500)    NOT NULL,
    option_c         VARCHAR(500)    NOT NULL,
    option_d         VARCHAR(500)    NOT NULL,
    -- 0 = A, 1 = B, 2 = C, 3 = D
    correct_option   TINYINT         NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
    created_by       BIGINT UNSIGNED DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_questions_class_subject   (class_name, subject),
    KEY idx_questions_subject         (subject),
    CONSTRAINT fk_questions_created_by
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. EXAMS
-- =============================================================================
CREATE TABLE exams (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title                VARCHAR(200)    NOT NULL,
    subject              VARCHAR(100)    NOT NULL,
    class_name           VARCHAR(30)     NOT NULL,
    duration_minutes     SMALLINT        NOT NULL DEFAULT 30,
    num_questions        SMALLINT        NOT NULL DEFAULT 10,
    randomize_questions  TINYINT(1)      NOT NULL DEFAULT 0,
    randomize_options    TINYINT(1)      NOT NULL DEFAULT 0,
    max_attempts         TINYINT         NOT NULL DEFAULT 1,
    start_time           DATETIME        DEFAULT NULL,
    end_time             DATETIME        DEFAULT NULL,
    is_active            TINYINT(1)      NOT NULL DEFAULT 1,
    created_by           BIGINT UNSIGNED DEFAULT NULL,
    created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_exams_class_active   (class_name, is_active),
    KEY idx_exams_subject        (subject),
    CONSTRAINT fk_exams_created_by
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 5. EXAM_QUESTIONS  (pivot: exam ↔ question)
-- =============================================================================
CREATE TABLE exam_questions (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    exam_id      BIGINT UNSIGNED NOT NULL,
    question_id  BIGINT UNSIGNED NOT NULL,
    sort_order   SMALLINT        NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_exam_question         (exam_id, question_id),
    KEY        idx_eq_exam_id           (exam_id),
    KEY        idx_eq_question_id       (question_id),
    CONSTRAINT fk_eq_exam
        FOREIGN KEY (exam_id)     REFERENCES exams     (id) ON DELETE CASCADE,
    CONSTRAINT fk_eq_question
        FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 6. EXAM_RESULTS  (one row per student submission)
-- =============================================================================
CREATE TABLE exam_results (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id       BIGINT UNSIGNED NOT NULL,
    exam_id          BIGINT UNSIGNED NOT NULL,
    score            SMALLINT        NOT NULL DEFAULT 0,
    total            SMALLINT        NOT NULL DEFAULT 0,
    submitted_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_taken_sec   INT             DEFAULT NULL,
    ip_address       VARCHAR(45)     DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_results_student_exam (student_id, exam_id),
    KEY idx_results_exam         (exam_id),
    KEY idx_results_submitted    (submitted_at),
    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_results_exam
        FOREIGN KEY (exam_id)    REFERENCES exams    (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 7. EXAM_ANSWERS  (per-question answer detail per submission)
-- =============================================================================
CREATE TABLE exam_answers (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    result_id        BIGINT UNSIGNED NOT NULL,
    question_id      BIGINT UNSIGNED NOT NULL,
    -- NULL means the student skipped this question
    selected_option  TINYINT         DEFAULT NULL CHECK (selected_option IS NULL OR selected_option BETWEEN 0 AND 3),
    is_correct       TINYINT(1)      NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_answers_result      (result_id),
    KEY idx_answers_question    (question_id),
    CONSTRAINT fk_answers_result
        FOREIGN KEY (result_id)   REFERENCES exam_results (id) ON DELETE CASCADE,
    CONSTRAINT fk_answers_question
        FOREIGN KEY (question_id) REFERENCES questions    (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SEED: Default super-admin account
-- Password: admin123  (bcrypt — change before production!)
-- =============================================================================
INSERT INTO users (name, email, password, role) VALUES (
    'Super Admin',
    'admin@cbtportal.edu',
    '$2y$12$someHashedPasswordHere',   -- replace with real bcrypt hash
    'super_admin'
);


-- =============================================================================
-- USEFUL VIEWS
-- =============================================================================

-- Result summary per student per exam
CREATE OR REPLACE VIEW v_result_summary AS
    SELECT
        r.id            AS result_id,
        s.reg_number,
        s.full_name,
        s.class_name,
        e.title         AS exam_title,
        e.subject,
        r.score,
        r.total,
        ROUND(r.score / NULLIF(r.total, 0) * 100, 1) AS percent,
        CASE WHEN r.score / NULLIF(r.total, 0) >= 0.5 THEN 'Pass' ELSE 'Fail' END AS status,
        r.submitted_at
    FROM exam_results r
    JOIN students s ON s.id = r.student_id
    JOIN exams    e ON e.id = r.exam_id;


-- Class-level performance summary
CREATE OR REPLACE VIEW v_class_performance AS
    SELECT
        s.class_name,
        e.title         AS exam_title,
        e.subject,
        COUNT(r.id)                                                     AS total_submissions,
        ROUND(AVG(r.score / NULLIF(r.total, 0) * 100), 1)              AS avg_percent,
        SUM(CASE WHEN r.score / NULLIF(r.total, 0) >= 0.5 THEN 1 END) AS pass_count,
        SUM(CASE WHEN r.score / NULLIF(r.total, 0) <  0.5 THEN 1 END) AS fail_count
    FROM exam_results r
    JOIN students s ON s.id = r.student_id
    JOIN exams    e ON e.id = r.exam_id
    GROUP BY s.class_name, e.id, e.title, e.subject;
