# Database Documentation

## Configuration

The database configuration is located in `src/config/database.ts`. It uses Sequelize ORM to connect to a PostgreSQL database.

## Models

### User

Represents a registered user.

**Attributes:**
- `id` (Integer, Primary Key, Auto-increment): Unique identifier.
- `email` (String, Required, Unique): User's email address.
- `password_hash` (String, Required): Hashed password.
- `created_at` (Date): Timestamp of creation.
- `updated_at` (Date): Timestamp of last update.

**Hooks:**
- `beforeCreate`: Hashes the password before saving a new user.
- `beforeUpdate`: Hashes the password if it has been changed.
