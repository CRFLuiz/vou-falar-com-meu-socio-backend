# LangChain Usage in vou-falar-com-meu-socio

## Overview

We use **[LangChain](https://js.langchain.com/docs/get_started/introduction)** to interface with Large Language Models (LLMs). It provides a standard interface for chains, lots of integrations with other tools, and end-to-end chains for common applications.

In this project, LangChain is primarily used for:
1.  Configuring and instantiating the Chat Model (`ChatOpenAI`).
2.  Creating structured prompts (`SystemMessage`, `HumanMessage`).
3.  Generating structured JSON outputs for various project stages.

## Configuration

The core configuration is handled in `src/services/projectAiService.ts` via the `buildChatModel` function.

### Environment Variables
-   `LITELLM_BASE_URL`: The base URL for the LLM service (default: `http://litellm:4000`).
-   `LITELLM_API_KEY` / `LITELLM_MASTER_KEY`: API key for authentication.
-   `PROJECT_AI_MODEL`: The specific model to use (default: `openrouter/openai/gpt-oss-120b`).

### Model Instantiation
We use the `ChatOpenAI` class from `@langchain/openai`. This allows us to use any OpenAI-compatible API (like LiteLLM or OpenRouter).

```typescript
new ChatOpenAI({
  modelName: model,
  apiKey: apiKey,
  temperature: 0.1, // Low temperature for deterministic, structured outputs
  configuration: {
    baseURL: `${baseUrl}/v1`,
    apiKey: apiKey,
  },
});
```

## Key Functions & Patterns

### 1. Structured JSON Generation
The primary pattern used across the application is **Prompt Engineering for JSON Extraction**.

Instead of using LangChain's output parsers (which can be brittle with some models), we instruct the model via the `SystemMessage` to return a specific JSON structure.

**Example Pattern:**
1.  Define a TypeScript interface for the expected data (e.g., `DiscoveryData`, `RiskAnalysisData`).
2.  Create a `SystemMessage` that acts as a persona (e.g., "Principal Software Architect").
3.  Explicitly describe the required JSON schema in the prompt.
4.  Pass the user input (or previous stage data) as a `HumanMessage`.
5.  Parse the string response into a JSON object.

**Used In:**
-   `generateStage1_Discovery`
-   `generateStage2_RiskScanner`
-   `generateStage3_Architecture`
-   `generateStage4_Engineering`
-   `generateStage5_RiskIntel`
-   `generateStage6_Estimation`
-   `generateStage7_Documents`

### 2. Profile Enhancement
In `src/services/profileAiService.ts`, LangChain is used to generate or improve user profile fields (`professional_title`, `professional_description`).

-   **Input:** User's current data (name, existing title/description).
-   **Task:** Improve the text to be more professional, translate if necessary, and ensure specific constraints (e.g., "no seniority words in title").
-   **Output:** JSON object with the improved fields.

## Why LangChain?
-   **Abstraction:** Decouples our code from the specific LLM provider API.
-   **Flexibility:** Easy to switch models or providers via environment variables.
-   **Ecosystem:** Access to a wide range of tools and integrations if needed in the future (e.g., vector stores, retrievers).
