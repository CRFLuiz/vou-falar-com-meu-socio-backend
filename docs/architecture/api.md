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
