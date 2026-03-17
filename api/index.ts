import { api, setTokens, loadTokensFromStorage } from './client'
import type { AdminLoginResponse, Student, Exam, Result, Paginated, Question, AdminUser } from './types'

export { loadTokensFromStorage, setTokens }

// --- Auth ---

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const { data } = await api.post<{ data: AdminUser; token: string }>('/admin/login', { email, password })
  setTokens(data.token)
  return { token: data.token, user: data.data }
}

export async function adminLogout(): Promise<void> {
  await api.post('/admin/logout')
  setTokens(null)
}

export async function studentLogin(regNumber: string): Promise<{ token: string; student: Student }> {
  const { data } = await api.post<{ data: Student; token: string }>('/student/login', { registration_number: regNumber })
  setTokens(data.token)
  return { token: data.token, student: data.data }
}

export async function studentLogout(): Promise<void> {
  await api.post('/student/logout')
  setTokens(null)
}

// --- Admin: Questions ---

export async function listQuestions(params: { page?: number } = {}): Promise<Paginated<Question>> {
  const { data } = await api.get<Paginated<Question>>('/admin/questions', { params })
  return data
}

export async function getQuestion(id: number): Promise<{ data: Question }> {
  const { data } = await api.get<{ data: Question }>(`/admin/questions/${id}`)
  return data
}

export async function createQuestion(payload: Partial<Question>): Promise<{ data: Question }> {
  const { data } = await api.post<{ data: Question }>('/admin/questions', payload)
  return data
}

export async function updateQuestion(id: number, payload: Partial<Question>): Promise<{ data: Question }> {
  const { data } = await api.put<{ data: Question }>(`/admin/questions/${id}`, payload)
  return data
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(`/admin/questions/${id}`)
}

// --- Admin: Exams ---

export async function listAdminExams(params: { page?: number } = {}): Promise<Paginated<Exam>> {
  const { data } = await api.get<Paginated<Exam>>('/admin/exams', { params })
  return data
}

export async function createExam(payload: Partial<Exam>): Promise<{ data: Exam }> {
  const { data } = await api.post<{ data: Exam }>('/admin/exams', payload)
  return data
}

export async function getAdminExam(id: number): Promise<{ data: Exam }> {
  const { data } = await api.get<{ data: Exam }>(`/admin/exams/${id}`)
  return data
}

export async function updateExam(id: number, payload: Partial<Exam>): Promise<{ data: Exam }> {
  const { data } = await api.put<{ data: Exam }>(`/admin/exams/${id}`, payload)
  return data
}

export async function deleteExam(id: number): Promise<void> {
  await api.delete(`/admin/exams/${id}`)
}

export async function assignExamQuestions(examId: number, questions: Array<{ question_id: number; sort_order: number }>): Promise<{ data: Exam }> {
  const { data } = await api.post<{ data: Exam }>(`/admin/exams/${examId}/assign-questions`, { questions })
  return data
}

// --- Admin: Students ---

export async function listStudents(params: { page?: number } = {}): Promise<Paginated<Student>> {
  const { data } = await api.get<Paginated<Student>>('/admin/students', { params })
  return data
}

export async function createStudent(payload: Partial<Student>): Promise<{ data: Student }> {
  const { data } = await api.post<{ data: Student }>('/admin/students', payload)
  return data
}

export async function updateStudent(id: number, payload: Partial<Student>): Promise<{ data: Student }> {
  const { data } = await api.put<{ data: Student }>(`/admin/students/${id}`, payload)
  return data
}

export async function deleteStudent(id: number): Promise<void> {
  await api.delete(`/admin/students/${id}`)
}

// --- Admin: Results ---

export async function listResults(): Promise<{ data: Result[] }> {
  const { data } = await api.get<{ data: Result[] }>('/admin/results')
  return data
}

// --- Super Admin: System Control ---

export async function getSystemSettings(): Promise<{ settings: Record<string, string>; global_active: boolean }> {
  const { data } = await api.get<{ settings: Record<string, string>; global_active: boolean }>('/admin/system-settings')
  return data
}

export async function updateSystemSettings(payload: Record<string, string | null>): Promise<void> {
  await api.post('/admin/system-settings', payload)
}

export async function toggleGlobalStatus(active: boolean): Promise<void> {
  await api.post('/admin/toggle-global-status', { active })
}

// --- Super Admin: Users ---

export async function listUsers(): Promise<{ data: AdminUser[] }> {
  const { data } = await api.get<{ data: AdminUser[] }>('/admin/users')
  return data
}

export async function createUser(payload: Partial<AdminUser>): Promise<{ data: AdminUser }> {
  const { data } = await api.post<{ data: AdminUser }>('/admin/users', payload)
  return data
}

export async function updateUser(id: number, payload: Partial<AdminUser>): Promise<{ data: AdminUser }> {
  const { data } = await api.put<{ data: AdminUser }>(`/admin/users/${id}`, payload)
  return data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}

// --- Student: Exams ---

export async function listStudentExams(params: { page?: number } = {}): Promise<Paginated<Exam>> {
  const { data } = await api.get<Paginated<Exam>>('/student/exams', { params })
  return data
}

export async function getStudentExam(id: number): Promise<{ data: Exam }> {
  const { data } = await api.get<{ data: Exam }>(`/student/exams/${id}`)
  return data
}

export async function submitExam(examId: number, payload: { answers: { question_id: number; selected_option: string }[] }): Promise<{ data: Result }> {
  const { data } = await api.post<{ data: Result }>(`/student/exams/${examId}/submit`, payload)
  return data
}

export type { AdminLoginResponse, Student, Exam, Result, Paginated, Question, AdminUser }
