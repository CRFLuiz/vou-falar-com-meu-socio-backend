# Users API

## Endpoints

### `GET /users/:id`

Retrieves user details by ID.

**Response:**
Returns the user object (excluding sensitive data like password hash).

### `PATCH /users/:id/profile`

Updates the user's profile information.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "professional_title": "Software Engineer",
  "professional_description": "Experienced developer...",
  "rate": "100.00",
  "hours_per_day": "8.00",
  "days_per_week": 5,
  "level": "Senior"
}
```

**Response:**
Returns the updated user object.
