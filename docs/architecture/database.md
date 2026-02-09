# Database Documentation

## Configuration

The database configuration is located in `src/config/database.ts`. It uses Sequelize ORM to connect to a PostgreSQL database.

## Models

### User

Represents a registered user.

**Attributes:**
- `id` (Integer, Primary Key, Auto-increment): Unique identifier.
- `name` (String, Required): User's full name.
- `email` (String, Required, Unique): User's email address.
- `password_hash` (String, Required): Hashed password.
- `professional_title` (String, Optional): User's professional title.
- `created_at` (Date): Timestamp of creation.
- `updated_at` (Date): Timestamp of last update.

**Hooks:**
- `beforeCreate`: Hashes the password before saving a new user.
- `beforeUpdate`: Hashes the password if it has been changed.
