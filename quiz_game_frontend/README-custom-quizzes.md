# Custom Quizzes

This app supports user-created quizzes with local persistence, sharing, and import/export.

Features:
- Build quizzes with title, description, category, and visibility.
- Add 2–6 options per question, choose the correct answer, and optionally add hint/explanation/reference URL.
- Autosave while editing and explicit Save with accessibility announcements.
- Share via link (token-based, URL-safe) without a backend.
- Export/import as JSON files for portability.
- Play custom quizzes using the same experience (lifelines, explanations, coins).
- Analytics and scoreboard record your play; category unlocks are not affected by custom quizzes.

## Getting started

- Open Custom Quiz from Start screen or navigate to `/custom`.
- Click “Create New” to start a quiz. Fill in details and add questions.
- Use the radio button to mark the correct option.
- Click “Save” to persist. Autosave also runs after edits.
- Click “Share” to copy a link (format `/custom/import/<token>`) that others can open to import.
- Click “Export JSON” to download the quiz to a file.

## Importing

- From `/custom`, choose “Import Link” and paste the token or full URL, then “Save to Library”.
- Or choose “Import JSON” and select a previously exported file.

## Notes

- Quizzes are saved in localStorage under a versioned key `customQuizzes.v1`.
- Each imported quiz is given a new ID and timestamps.
- Short tokens encode quiz content as URL-safe Base64 of a compact JSON shape (no external backend).
- No environment variables or backend are required for custom quizzes.
