# Cheerio & Axios (Web Scraping)

This document describes the web scraping capabilities implemented in the backend, primarily using `axios` for HTTP requests and `cheerio` for HTML parsing.

## Overview

The scraping functionality is designed to extract project descriptions and relevant context from freelancer platforms or client websites. It is exposed both as a direct utility function and as a LangChain tool for AI agents.

## Core Logic (`src/services/scraperService.ts`)

### 1. HTTP Request (`axios`)
-   **User-Agent Spoofing:** Requests include a standard browser User-Agent header to avoid basic bot detection mechanisms.
    ```typescript
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
    ```

### 2. HTML Parsing & Cleaning (`cheerio`)
Once the HTML is fetched, `cheerio` is used to:
1.  **Load the DOM:** Parse the raw HTML string.
2.  **Remove Noise:** Elements that don't contain core content are removed to reduce token usage and noise:
    -   `<script>`, `<style>`
    -   `<nav>`, `<footer>`, `<header>`
    -   `<iframe>`, `<noscript>`
3.  **Link Resolution (Crucial for AI Context):**
    -   The scraper iterates over all `<a>` tags.
    -   It resolves relative URLs to absolute URLs based on the source page URL.
    -   It rewrites the link text to the format: `Link Text (Link: https://absolute-url.com)`.
    -   **Why?** This allows the AI model to "see" the URLs in the plain text output, enabling it to request further scraping of client profiles or external references using the `scrape_url` tool.
4.  **Text Extraction:**
    -   Extracts text from the `<body>`.
    -   Normalizes whitespace (removes excessive spaces/newlines).
    -   Truncates the result to **10,000 characters** to stay within token limits.

## Usage

### As a Utility Function

Use `scrapeProjectUrl` when you need to fetch content directly in your code (e.g., in a controller).

```typescript
import { scrapeProjectUrl } from '../services/scraperService';

const url = 'https://www.example.com/project/123';
try {
  const text = await scrapeProjectUrl(url);
  console.log(text); 
  // Output: "Project Title... (Link: https://...)..."
} catch (error) {
  console.error('Failed to scrape');
}
```

### As a LangChain Tool

The `scrapeUrlTool` wraps the utility function in a `DynamicStructuredTool` compatible with LangChain agents.

-   **Name:** `scrape_url`
-   **Description:** "Scrapes the content of a given URL. Use this to get information from client profiles, company pages, or other relevant links found in the project description."
-   **Schema:** `{ url: string }`

**Integration Example:**

```typescript
import { scrapeUrlTool } from '../services/scraperService';
import { createAgent } from '...';

const tools = [scrapeUrlTool];
const agent = createAgent({ ..., tools });

// The agent can now decide to call:
// { tool: "scrape_url", toolInput: { url: "https://client-profile..." } }
```

## Configuration

Currently, configuration (like User-Agent string and truncation limit) is hardcoded in `src/services/scraperService.ts`.

-   **Timeout:** Default axios timeout (unless specified otherwise in global config).
-   **Max Length:** 10,000 characters.

## Related Files

-   [src/services/scraperService.ts](../../../src/services/scraperService.ts): Implementation.
-   [src/controllers/ProjectController.ts](../../../src/controllers/ProjectController.ts): Usage in project import.
-   [src/services/projectAiService.ts](../../../src/services/projectAiService.ts): Usage of `scrapeUrlTool` in AI agents.
