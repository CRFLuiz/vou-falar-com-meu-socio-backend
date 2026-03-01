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
- `name` (String, Optional): Full name.
- `professional_title` (String, Optional): Professional job title.
- `professional_description` (Text, Optional): Detailed professional description.
- `rate` (Decimal, Optional): Hourly/project rate.
- `hours_per_day` (Decimal, Optional): Available hours per day.
- `days_per_week` (Integer, Optional): Available days per week.
- `level` (String, Optional): Seniority level.
- `created_at` (Date): Timestamp of creation.
- `updated_at` (Date): Timestamp of last update.

**Hooks:**
- `beforeCreate`: Hashes the password before saving a new user.
- `beforeUpdate`: Hashes the password if it has been changed.

### Project

Represents a user's project.

**Attributes:**
- `id` (Integer, Primary Key, Auto-increment): Unique identifier.
- `name` (String, Required): Project name.
- `description` (Text, Optional): Project description.
- `status` (String, Required): Project status (default: 'pending').
- `discovery_data` (JSONB, Optional): Data for the Discovery stage.
- `risk_analysis_data` (JSONB, Optional): Data for the Risk Analysis stage.
- `architecture_data` (JSONB, Optional): Data for the Architecture stage.
- `engineering_data` (JSONB, Optional): Data for the Engineering stage.
- `risk_intel_data` (JSONB, Optional): Data for the Risk Intel stage.
- `estimation_data` (JSONB, Optional): Data for the Estimation stage.
- `documents_data` (JSONB, Optional): Data for the Documents stage.
- `created_at` (Date): Timestamp of creation.
- `updated_at` (Date): Timestamp of last update.
