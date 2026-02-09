# API Documentation

## Auth Routes

### POST /auth/signup

Registers a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "professional_title": "Developer"
}
```

**Response (201 Created):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "professional_title": "Developer",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Name, email, and password are required"
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
