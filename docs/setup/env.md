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
| `MARKDOWN_TO_HTML` | Enables Markdown→HTML debug file output when not set to `false` or `off`. | *(enabled by default)* |

## Markdown→HTML Debug Output

The backend includes a Markdown→HTML conversion service (`src/services/markdownToHtmlService.ts`) that can persist debug artifacts for inspection.

### When it runs

Debug file output is enabled unless `MARKDOWN_TO_HTML` is explicitly set to `false` or `off` (case-insensitive).

### Where files are written

Files are written to a directory named `md2html-vfcms-debug` under the application working directory (`process.cwd()`).

In the Docker Compose setup, the backend working directory is typically `/app`, so the default path becomes:

```text
/app/md2html-vfcms-debug
```

Because `/app` is usually bind-mounted to the backend repository on the host, the artifacts are visible on the host under:

```text
vou-falar-com-meu-socio-backend/md2html-vfcms-debug
```

### Output format

For each conversion, the service writes two files with the same base name:

```text
<timestamp>-<uuid>.md
<timestamp>-<uuid>.html
```
