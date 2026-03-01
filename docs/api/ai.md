# AI API

## Endpoints

### `POST /ai/profile/help-required`

Generates or improves the required profile fields using AI.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "professional_title": "Software Engineer",
  "professional_description": "I build web applications focused on performance and usability.",
  "language": "en"
}
```

**Notes:**
- `language` is optional (defaults to `en`).
- The AI output is expected to follow the UI rules (e.g., title without level words, description in first person).

**Response:**
```json
{
  "professional_title": "Software Engineer",
  "professional_description": "I build web applications focused on performance, usability, and maintainability.",
  "changed": {
    "professional_title": true,
    "professional_description": true
  }
}
```
