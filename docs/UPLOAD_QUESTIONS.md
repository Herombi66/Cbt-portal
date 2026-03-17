# Bulk Upload: Questions

Supported file formats:
- CSV: columns include `type, subject, class, question, option_a..d, correct_option, expected_answer, answer_bool, score, difficulty, tags`
- JSON: array of objects with the same fields
- Excel: planned (requires Excel parser library)

Supported question types:
- mcq: Multiple Choice
- fib: Fill-in-the-Blank
- boolean: True/False
- essay/matching: planned extensions

Field Mapping:
- Common: `type`, `subject`, `class` (or `class_name`), `question` (or `question_text`), `score`, `difficulty`, `tags` (comma list)
- mcq: `option_a..option_d`, `correct_option` (A/B/C/D or 1/2/3/4)
- fib: `expected_answer` (string, required)
- boolean: `answer_bool` (true/false, accepts true/t/1 or false/f/0)

Validation & Error Handling:
- Per-row validation returns detailed messages with row indices
- Upload report summarizes errors and skipped rows
- Rollback threshold: configurable % error rate; upload aborts if exceeded

Performance:
- Processes rows in chunks with progress tracking for large files
- Memory-efficient by streaming and periodic yielding

API Integration:
- The upload prepares normalized question objects compatible with the Question Management UI and API contracts

Examples:

CSV:
```
type,subject,class,question,option_a,option_b,option_c,option_d,correct_option,expected_answer,answer_bool,score,difficulty,tags
mcq,Mathematics,SS3,What is 2 + 2?,3,4,5,6,B,,,1,easy,arithmetic,addition
fib,English,SS2,Fill in: The capital of France is ____,,,,,,,"Paris",,2,medium,geography
boolean,Science,SS1,Water boils at 100°C at sea level,,,,,,,true,1,easy,physics
```

JSON:
```
[
  {"type":"mcq","subject":"Mathematics","class":"SS3","question":"What is 2 + 2?","option_a":"3","option_b":"4","option_c":"5","option_d":"6","correct_option":"B","score":1,"difficulty":"easy","tags":"arithmetic,addition"},
  {"type":"fib","subject":"English","class":"SS2","question":"Fill in: The capital of France is ____","expected_answer":"Paris","score":2,"difficulty":"medium","tags":"geography"},
  {"type":"boolean","subject":"Science","class":"SS1","question":"Water boils at 100°C at sea level","answer_bool":"true","score":1,"difficulty":"easy","tags":"physics"}
]
```

