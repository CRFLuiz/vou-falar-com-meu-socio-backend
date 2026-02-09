# Development & Documentation Rules

This file establishes the core rules for development and documentation within this repository. All contributors (humans and AI agents) must adhere to these guidelines.

## 1. Comprehensive Documentation
The `docs/` folder must serve as the single source of truth for the repository. It must document:
- **Logic & Implementation Details:** How things work.
- **Business Rules:** The "why" behind the logic.
- **Structure & Architecture:** System design and organization.
- **Features:** What the system does.
- **Libraries & Dependencies:** What is used, why it was chosen, and its role.
- **Key Decisions:** Any other important context.

## 2. English Only
All content must be in English. This applies to:
- Documentation files (`.md`, etc.).
- Variable names, function names, class names.
- File and directory names.
- Code comments and commit messages.

## 3. Documentation Structure
Documentation must be organized into folders based on context.
- **Example:** Architecture-related documents go into `docs/architecture/`.
- **Flexibility:** Contributors (devs or AI) have full authority to create new folders/files or restructure existing documentation to improve clarity and organization.

## 4. The START_HERE.md Convention
Every folder within `docs/` (including the root `docs/`) must contain a `START_HERE.md` file.
- **Purpose:** Serve as an index and entry point for that specific directory.
- **Content:** A list of all files and subfolders in the same directory, accompanied by a brief description of each item.

## 5. Continuous Documentation
Documentation is not a one-time task; it is a continuous process.
- **Update on Change:** Every code change (addition, modification, deletion) must be accompanied by a review of the documentation.
- **Action Required:** Create, update, or remove documentation as needed to reflect the current state of the codebase.

## 6. AI Agent Workflow
The most efficient way for AI agents to understand the repository is by reading the documentation, starting from the `START_HERE.md` files.
- **Navigation:** Start at `docs/START_HERE.md` and traverse the documentation tree as needed.
- **Context Management:** This approach allows agents to identify exactly which specific documents are relevant to their task, avoiding unnecessary token consumption and context overload.
