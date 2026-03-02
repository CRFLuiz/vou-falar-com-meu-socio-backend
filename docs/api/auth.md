# Auth API

## Endpoints

### `POST /auth/signup`

Registers a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (201 Created):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### `POST /auth/login`

Authenticates a user and returns a token (implementation detail depending on AuthController).

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
Returns authentication details (e.g., token, user info).
