# AI Recovery Report

- Date/time: 2026-07-13T08:51:39.480Z
- Environment: local
- Provider/model: none
- Credential presence: Gemini=no, Groq=no
- Commands run: npm run eval:recovery
- Pass/fail totals: 0 passed, 1 failed

## Credential Status

- Gemini: credential present: no
- Groq: credential present: no

## Provider Calls

- No provider calls recorded

## Latency Results

- None

## Failures Found

- Recovery gate requires both GEMINI_API_KEY and GROQ_API_KEY in the evaluation environment to prove real provider fallback.

## Fixes Applied

- Recovery gate now fails unless provider-to-provider fallback can be proven.

## Remaining Known Issues

- Recovery gate requires both GEMINI_API_KEY and GROQ_API_KEY in the evaluation environment to prove real provider fallback.
