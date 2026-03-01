# Projects API

## CRUD Endpoints

### `POST /projects`

Creates a new project manually.

**Request Body:**
```json
{
  "name": "Project Name",
  "description": "Project Description",
  "status": "pending"
}
```

### `GET /projects`

Retrieves a list of all projects.

### `GET /projects/:id`

Retrieves a single project by ID.

### `PUT /projects/:id`

Updates an existing project.

### `DELETE /projects/:id`

Deletes a project.

## Import Endpoint

### `POST /projects/import`

**Description:**
Imports a project by scraping a URL and/or using a provided text description. The content is processed by an AI agent to extract structured data.

**Request Body:**
```json
{
  "projectUrl": "https://www.99freelas.com.br/project/...",
  "projectText": "Additional details about the project..."
}
```

**Behavior:**
1.  **Input Validation:** At least one field (`projectUrl` or `projectText`) must be provided.
2.  **Scraping:** If `projectUrl` is provided, the backend scrapes the full page content.
3.  **AI Extraction:** The scraped content (if any) and the user text are combined. An AI agent processes this input to extract:
    *   Project Name
    *   Full Description (no summarization)
    *   Budget
    *   Deadline
    *   Technologies
4.  **Logging:** The raw AI response is logged to the console for debugging purposes.

**Response:**
Returns the created Project object.

## Stage Generation Endpoints

These endpoints trigger AI processing for specific project stages.

### `POST /projects/:id/stage/discovery`
Generates the Discovery stage data.

### `POST /projects/:id/stage/risk-analysis`
Generates the Risk Analysis stage data.

### `POST /projects/:id/stage/architecture`
Generates the Architecture stage data.

### `POST /projects/:id/stage/engineering`
Generates the Engineering stage data.

### `POST /projects/:id/stage/risk-intel`
Generates the Risk Intel stage data.

### `POST /projects/:id/stage/estimation`
Generates the Estimation stage data.

### `POST /projects/:id/stage/documents`
Generates the Documents stage data.
