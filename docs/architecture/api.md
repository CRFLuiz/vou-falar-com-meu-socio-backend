# API Documentation

## Auth Routes

### POST /auth/signup

Registers a new user.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response (201 Created):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Email and password are required"
}
```

**Response (409 Conflict):**
```json
{
  "message": "Email already exists"
}
```

## Health Check

### GET /health

Checks the health status of the backend.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## AI Routes

### POST /ai/profile/help-required

Generates or improves the required profile fields using AI. The output is returned as JSON.

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
- `language` is optional and should be one of: `en`, `pt`, `es`. If missing or invalid, it defaults to `en`.
- The AI output is expected to follow the UI rules (e.g., title without level words, description in first person).

**Response (200 OK):**
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
