# CBT App Integration Documentation

This document describes the integration between the React frontend and the Laravel backend.

## 1. Authentication

The system uses **Laravel Sanctum** for authentication.

### Admin Login
- **Endpoint**: `POST /api/admin/login`
- **Request**: `{ email, password }`
- **Response**: `{ token, user: { id, name, email, role } }`
- **Pattern**: The token is stored in `localStorage` and injected into the `Authorization` header as a `Bearer` token for subsequent requests.

### Student Login
- **Endpoint**: `POST /api/student/login`
- **Request**: `{ registration_number }`
- **Response**: `{ token, student: { id, name, registration_number, email } }`

## 2. API Service Layer

The frontend uses an Axios-based service layer located in `api/`.

- `api/client.ts`: Configures the Axios instance with interceptors for authentication and error handling.
- `api/index.ts`: Defines high-level service functions for all entities.
- `api/types.ts`: TypeScript interfaces matching backend resources.

## 3. API Endpoints (Admin)

| Entity | Method | Endpoint | Description |
|---|---|---|---|
| Questions | GET | `/api/admin/questions` | List all questions (paginated) |
| Questions | POST | `/api/admin/questions` | Create a new question |
| Questions | PUT | `/api/admin/questions/{id}` | Update a question |
| Questions | DELETE | `/api/admin/questions/{id}` | Delete a question |
| Exams | GET | `/api/admin/exams` | List all exams |
| Exams | POST | `/api/admin/exams` | Create a new exam |
| Exams | PUT | `/api/admin/exams/{id}` | Update an exam |
| Exams | DELETE | `/api/admin/exams/{id}` | Delete an exam |
| Exams | POST | `/api/admin/exams/{id}/assign-questions` | Assign questions to an exam |
| Students | GET | `/api/admin/students` | List all students |
| Students | POST | `/api/admin/students` | Register a new student |
| Students | PUT | `/api/admin/students/{id}` | Update student details |
| Students | DELETE | `/api/admin/students/{id}` | Delete a student |
| Results | GET | `/api/admin/results` | List all exam results |

## 4. API Endpoints (Student)

| Entity | Method | Endpoint | Description |
|---|---|---|---|
| Exams | GET | `/api/student/exams` | List exams available to the student |
| Exams | GET | `/api/student/exams/{id}` | Get exam details with questions |
| Exams | POST | `/api/student/exams/{id}/submit` | Submit exam answers |

## 5. Error Handling

- **Global Interceptor**: The Axios response interceptor in `api/client.ts` handles `401 Unauthenticated` errors by clearing the session.
- **Component Level**: API calls are wrapped in `try/catch` blocks with user-friendly toast notifications.
- **Error Boundaries**: A React Error Boundary is implemented in `cbt-app.jsx` to catch and display UI-breaking errors.

## 6. Environment Configuration

- **VITE_API_BASE_URL**: Defined in `.env` file to point to the backend server (default: `http://localhost:8000`).

## 7. CORS Configuration

- Backend CORS is configured in `cbt-portal/config/cors.php` to allow requests from the frontend origin.
