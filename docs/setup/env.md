# Environment Setup

This project uses `dotenv` to manage environment variables.

## Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server listens on. | `3000` |
| `NODE_ENV` | Environment (development/production). | `development` |
| `DB_HOST` | Postgres host. | `postgres` |
| `DB_PORT` | Postgres port. | `5432` |
| `DB_USER` | Postgres user. | `postgres` |
| `DB_PASSWORD` | Postgres password. | `postgres` |
| `DB_NAME` | Postgres database name. | `vou_falar_com_meu_socio` |
| `CORS_ORIGIN` | Allowed CORS origin. | `*` |
