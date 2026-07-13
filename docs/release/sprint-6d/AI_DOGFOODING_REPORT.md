# AI Dogfooding Report

- Date/time: 2026-07-13T08:51:39.501Z
- Environment: local
- Provider/model: none
- Credential presence: Gemini=no, Groq=no
- Commands run: npm run eval:dogfooding
- Pass/fail totals: 0 passed, 1 failed

## Credential Status

- Gemini: credential present: no
- Groq: credential present: no

## Provider Calls

- No provider calls recorded

## Latency Results

- None

## Failures Found

- Evaluation environment has no real provider credentials loaded (checked process env and .env.eval): configure GEMINI_API_KEY or GROQ_API_KEY.

## Fixes Applied

- Dogfooding gate now fails when no real provider call can be proven.

## Remaining Known Issues

- Evaluation environment has no real provider credentials loaded (checked process env and .env.eval): configure GEMINI_API_KEY or GROQ_API_KEY.
