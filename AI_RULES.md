# StarryGen - AI Rules & Tech Stack

## Tech Stack

*   **Framework**: React 19 (Functional Components + Hooks)
*   **Language**: TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS (Custom configuration in `tailwind.config.js`)
*   **Icons**: `lucide-react`
*   **AI Integration**: Google GenAI SDK (`@google/genai`) via Gemini 2.5 Flash
*   **State Management**: React Local State (`useState`, `useReducer`, `Context` if needed) - No external libraries like Redux.

## Development Rules

1.  **UI Components**:
    *   **Do not** import external UI component libraries (like Shadcn, MUI, Chakra) unless explicitly requested.
    *   **ALWAYS** use the internal UI primitives defined in `src/components/UI.tsx` (e.g., `Button`, `Input`, `Modal`, `Select`, `Toggle`, `Accordion`).
    *   Extend `UI.tsx` if a new primitive is absolutely necessary, rather than creating one-off styled elements in feature components.

2.  **Styling**:
    *   Use **Tailwind CSS** for all styling.
    *   Utilize the custom color palette defined in `tailwind.config.js` (`bg-surface`, `bg-surfaceHighlight`, `text-text-muted`, `text-primary-500`, etc.) to ensure theme consistency (Dark Mode).
    *   Avoid hardcoded hex values in components; use the semantic names.

3.  **Icons**:
    *   Exclusively use `lucide-react`.
    *   Import specific icons as `import * as Icons from 'lucide-react'` or named imports.

4.  **Architecture**:
    *   **Blocks System**: The core logic relies on `BlockState` and `BlockDefinition` types. When adding new generation features, add them to `BLOCK_DEFINITIONS` in `src/constants.ts` rather than hardcoding UI.
    *   **Services**: Keep all AI/API logic in `src/services/geminiService.ts`. Do not make API calls directly inside components.
    *   **Types**: Define all shared interfaces in `src/types.ts`.

5.  **Code Quality**:
    *   Strictly use TypeScript. Avoid `any` where possible.
    *   Ensure all new files follow the project's directory structure (`src/components`, `src/services`, etc.).