# LangGraph Usage in vou-falar-com-meu-socio

## Overview

**[LangGraph](https://langchain-ai.github.io/langgraphjs/)** is a library for building stateful, multi-actor applications with LLMs. It is built on top of LangChain and allows you to create complex workflows with cycles, persistence, and state management.

In this project, LangGraph is used to orchestrate the process of improving user profile fields (`professional_title` and `professional_description`).

## Usage Context

### Profile AI Service
The primary usage is in `src/services/profileAiService.ts`. The goal is to improve or generate professional profile information based on user input.

**Why LangGraph?**
LangGraph is ideal here because the task involves a sequence of steps (nodes) that depend on a shared state. It allows us to:
1.  Define a clear workflow.
2.  Pass data between steps seamlessly.
3.  Handle different "modes" (e.g., generating missing fields vs. improving existing ones).

## Key Components

### 1. State Annotation (`Annotation.Root`)
Defines the structure of the state that flows through the graph.

```typescript
const StateAnnotation = Annotation.Root({
  name: Annotation<string>,
  professionalTitle: Annotation<string>,
  professionalDescription: Annotation<string>,
  language: Annotation<string>,
  mode: Annotation<ProfileGraphMode>,
  nextProfessionalTitle: Annotation<string>,
  nextProfessionalDescription: Annotation<string>,
});
```

-   **Input State:** `name`, `professionalTitle`, `professionalDescription`, `language`, `mode`.
-   **Output State:** `nextProfessionalTitle`, `nextProfessionalDescription`.

### 2. Nodes
Nodes represent individual steps in the workflow.

#### `descriptionNode`
-   **Purpose:** Improves or generates the `professional_description`.
-   **Input:** Current `professionalDescription` (or missing).
-   **Output:** Updates `nextProfessionalDescription` in the state.
-   **Logic:** Uses `ChatOpenAI` to generate a professional, first-person description.

#### `titleNode`
-   **Purpose:** Improves or generates the `professional_title`.
-   **Input:** `professionalTitle` (or missing) AND the potentially updated `nextProfessionalDescription`.
-   **Output:** Updates `nextProfessionalTitle` in the state.
-   **Logic:** Uses `ChatOpenAI` to generate a concise title that matches the description and avoids seniority words.

### 3. Graph Construction (`StateGraph`)
The graph defines the flow between nodes.

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode('descriptionNode', async (s) => { ... })
  .addNode('titleNode', async (s) => { ... })
  .addEdge(START, 'descriptionNode') // Start -> Description
  .addEdge('descriptionNode', 'titleNode') // Description -> Title
  .addEdge('titleNode', END); // Title -> End
```

**Flow:**
1.  **Start**: Graph begins execution.
2.  **Description Node**: First, the description is processed. This ensures the title generation has the most up-to-date context.
3.  **Title Node**: Then, the title is processed, using the improved description as context.
4.  **End**: Graph execution completes, returning the final state.

### 4. Compilation & Invocation
The graph is compiled into a runnable object.

```typescript
const app = graph.compile();
const result = await app.invoke({ ...initialState });
```

The result contains the final state, from which we extract the improved `professional_title` and `professional_description`.
