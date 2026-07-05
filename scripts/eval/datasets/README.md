# Evaluation Datasets

## Structure

- `resumes.json` — Array of `NormalizedResume` objects with unique IDs
- `job-descriptions.json` — Array of `{ id, label, text }` objects

## Adding New Data

1. Add a new resume object to `resumes.json` with a unique `id` (e.g., `resume-16`)
2. Add a matching job description to `job-descriptions.json` with `jd-16`
3. The eval runner will automatically pick them up

## Format

Resume format follows the `NormalizedResume` interface from `@careerlaunch/ai`:

```ts
interface EvalResume {
  id: string;
  label: string;
  contact: { fullName, email, phone, location, website };
  summary: string;
  sections: Array<{ id, type: "experience", role, company, bullets: string[], dateRange }>;
  skills: string[];
  certifications: string[];
  projects: string[];
}
```

Job description format:

```ts
interface EvalJobDescription {
  id: string;
  label: string;
  text: string;
}
```

## Running

```bash
npm run eval
```

With specific modes:

```bash
npm run eval -- --gap          # Only run gap analysis tests
npm run eval -- --tailor       # Only run tailoring tests
npm run eval -- --analysis     # Only run job analysis tests
npm run eval -- --ai           # Also run with configured AI provider
npm run eval -- --json         # Output as JSON for CI
```
