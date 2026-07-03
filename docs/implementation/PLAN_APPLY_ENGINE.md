# Plan: Apply Engine

## What

A pure-function apply engine that maps AI suggestions into safe, validated resume mutations. No DB, no API, no React — just typed transforms over `ResumeDocument`.

## File Structure

```
packages/ai/src/apply/
  types.ts          — operation union, AppliedChange type
  apply.ts          — applyChanges(): dispatches operations
  operations/
    index.ts        — re-export barrel
    summary.ts      — replace_summary
    bullet.ts       — replace_bullet
    skill.ts        — replace_skill, add_skill, remove_skill
  index.ts          — public API barrel

packages/ai/__tests__/apply/
  apply.test.ts     — unit tests
```

## Types

### Operation (discriminated union)

| Discriminator | Fields | Validation |
|---|---|---|
| `replace_summary` | `summary: string` | none (empty string is valid) |
| `replace_bullet` | `sectionId: ResumeSectionId, entryId: string, bulletIndex: number, text: string` | entryId must exist in section; bulletIndex must be within bounds |
| `replace_skill` | `index: number, skill: string` | index must be valid skills index |
| `add_skill` | `skill: string, index?: number` | index must be 0..skills.length if provided; default appends |
| `remove_skill` | `index: number` | index must be valid skills index |

### AppliedChange

```ts
interface AppliedChange {
  operation: ApplyOperation["type"];
  path: string;       // human-readable path like "experience[exp-1].bullets[2]"
  before: string | null;
  after: string | null;
}
```

### ApplyResult

```ts
interface ApplyResult {
  updatedResume: ResumeDocument;
  appliedChanges: AppliedChange[];
}
```

## Operation Detail

### replace_summary
- Deep-copy resume, set `.summary`, return copy + change record
- path: `"summary"`

### replace_bullet
- Match `entryId` in `experience`, `projects`, or `education` arrays
- Validate `bulletIndex` is within bounds
- Return copy with replaced string
- path: `"experience[{id}].bullets[{index}]"` or similar

### replace_skill / add_skill / remove_skill
- Simple array operations on `resume.skills`
- Validate index bounds via `0 <= index < skills.length` (replace/remove) or `0 <= index <= skills.length` (add)
- Deep-copy the full resume before mutating the copy

## applyChanges()

```ts
function applyChanges(resume: ResumeDocument, operations: ApplyOperation[]): ApplyResult
```

- Iterates operations in order, threading the result of each into the next (pure pipeline)
- Each step builds onto the `appliedChanges` array
- Validates each operation's target exists before applying; throws `ApplyError` with message if not
- Never mutates the original resume

## Error Handling

- `ApplyError` extends `Error` with `operation: ApplyOperation` and `reason: string`
- Thrown when: entryId not found, bulletIndex out of range, skill index out of range
- No silent fallback — fail fast so the caller can decide how to handle

## Tests

Cover:
- Each operation succeeds on valid input
- Each operation correctly returns before/after in AppliedChange
- replace_bullet with invalid entryId throws
- replace_bullet with out-of-range bulletIndex throws
- replace_skill / remove_skill with out-of-range index throws
- add_skill appends by default
- add_skill inserts at specified index
- remove_skill removes the correct skill
- Original resume is never mutated after any operation
- Multiple operations in sequence compose correctly (each sees the previous output)
- `replace_summary` handles empty string
