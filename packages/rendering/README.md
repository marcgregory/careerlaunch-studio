# Rendering Package

`@careerlaunch/rendering` owns resume presentation code shared by preview and export surfaces.

## Browser-Safe Preview

The package root exports `ResumePreview` from `src/index.tsx`. This entry is safe for client components and browser bundles. Keep it free of Node-only modules, Playwright imports, filesystem access, or server-only dependencies because the builder imports it directly for the live preview.

## Server-Only PDF Renderer

The `@careerlaunch/rendering/pdf` subpath exports `renderResumePdf` from `src/pdf.tsx`. This entry is server-only and uses Playwright Chromium plus React static markup rendering to produce real PDF bytes.

Import the PDF renderer only from route handlers, server actions, jobs, or other server-only code:

```ts
import { renderResumePdf } from "@careerlaunch/rendering/pdf";
```

Do not import `@careerlaunch/rendering/pdf` from client components. Keeping the preview and PDF entries separate prevents browser bundles from pulling in Playwright and Node runtime modules.
