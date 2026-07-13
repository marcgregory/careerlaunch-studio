# AI Eval Preflight

- Date/time: 2026-07-13T09:39:17.573Z
- Environment: production
- Provider/model: groq/llama-3.1-8b-instant
- Credential presence: Gemini=yes, Groq=yes
- Commands run: npm run eval:preflight
- Pass/fail totals: 1 passed, 0 failed

## Credential Status

- Gemini: credential present: yes
- Groq: credential present: yes

## Provider Calls

- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: preflight.matchJob
  Duration: 543ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable

## Latency Results

- preflight.matchJob: 543ms

## Failures Found

- None

## Fixes Applied

- Preflight now performs a real provider matchJob call and validates metadata.

## Remaining Known Issues

- None
