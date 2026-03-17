# Question Formats

Supported types:
- mcq: Multiple choice with four options and a correct index
- fib: Fill-in-the-blank with a string expected answer
- boolean: True/False with a boolean expected value

Frontend payloads:
- mcq: `{ id, subject, className, text, type: "mcq", options: string[], correct: number }`
- fib: `{ id, subject, className, text, type: "fib", answer: string }`
- boolean: `{ id, subject, className, text, type: "boolean", answerBool: boolean }`

Grading rules:
- mcq: selected index equals `correct`
- fib: case-insensitive, trimmed equality against `answer`; blank answers are invalid
- boolean: case-insensitive match of user input `"true"`/`"false"` against `answerBool`

Backend schema (Laravel):
- Table `questions`:
  - `type` enum: `mcq`|`fib`|`boolean`
  - `question_text` text
  - MCQ fields: `option_a`..`option_d`, `correct_option`
  - FIB field: `expected_answer`
  - Boolean field: `is_true`
  - Index on `(class_name, subject)`

