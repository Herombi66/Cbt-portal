export type Role = 'admin' | 'super_admin'

export interface AdminLoginResponse {
  token: string
  user: { id: number; name: string; email: string; role: Role }
}

export interface Student {
  id: number
  name: string
  registration_number: string
  email: string
  class_name?: string
  gender?: string
  created_at: string
  updated_at: string
}

export interface Question {
  id: number
  subject: string
  class_name: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  created_at?: string
  updated_at?: string
}

export interface Exam {
  id: number
  title: string
  description?: string | null
  duration_minutes: number
  starts_at?: string | null
  ends_at?: string | null
  is_active: boolean
  questions_count?: number
  questions?: Question[]
  created_at?: string
  updated_at?: string
}

export interface Result {
  id: number
  student_id: number
  exam_id: number
  score: number
  total_questions: number
  submitted_at: string
  answers?: { question_id: number; selected_option: string; is_correct: boolean }[]
}

export interface Paginated<T> {
  data: T[]
  links?: Record<string, string | null>
  meta?: { current_page: number; last_page: number; per_page: number; total: number }
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: Role
  created_at?: string
  updated_at?: string
}