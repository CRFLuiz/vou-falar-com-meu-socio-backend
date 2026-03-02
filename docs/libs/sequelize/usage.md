# Sequelize Usage in vou-falar-com-meu-socio

## Overview

We use **[Sequelize](https://sequelize.org/)** as our ORM (Object-Relational Mapper) to interact with the PostgreSQL database. It allows us to define models in TypeScript and perform database operations using standard JavaScript methods.

## Configuration

The database connection is configured in `src/config/database.ts`.

### Environment Variables
-   `DB_NAME`: Database name (default: `vou_falar_com_meu_socio`)
-   `DB_USER`: Database user (default: `postgres`)
-   `DB_PASSWORD`: Database password (default: `postgres`)
-   `DB_HOST`: Database host (default: `postgres`)
-   `DB_PORT`: Database port (default: `5432`)

### Initialization
The Sequelize instance is initialized with the Postgres dialect. Logging is disabled by default to keep the console clean.

```typescript
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
  }
);
```

## Models

Models are defined in the `src/models/` directory.

### User Model (`src/models/User.ts`)
Represents the application users.
-   **Fields:** `email`, `password_hash`, `name`, `professional_title`, `professional_description`, `rate`, `hours_per_day`, `days_per_week`, `level`.
-   **Hooks:** Uses `beforeCreate` and `beforeUpdate` hooks to hash passwords using `bcryptjs`.

### Project Model (`src/models/Project.ts`)
Represents the projects created by users.
-   **Fields:** `name`, `description`, `status`.
-   **JSON Fields:** Stores structured data for each stage of the AI analysis:
    -   `discovery_data`
    -   `risk_analysis_data`
    -   `architecture_data`
    -   `engineering_data`
    -   `risk_intel_data`
    -   `estimation_data`
    -   `documents_data`

## Database Synchronization

The application uses `sequelize.sync({ alter: true })` in `src/index.ts` to automatically synchronize the database schema with the models on startup.
-   **`alter: true`**: This option checks what is the current state of the table in the database (which columns it has, what are their data types, etc), and then performs the necessary changes in the table to make it match the model.

## Common Patterns

### CRUD Operations
We use standard Sequelize methods in our controllers:
-   `User.findByPk(id)`
-   `User.findOne({ where: { email } })`
-   `User.create(data)`
-   `user.save()` or `user.update(data)`
