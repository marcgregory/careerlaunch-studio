# AI Recovery Report

- Date/time: 2026-07-13T09:45:21.081Z
- Environment: production
- Provider/model: groq/llama-3.1-8b-instant
- Credential presence: Gemini=yes, Groq=yes
- Commands run: npm run eval:recovery
- Pass/fail totals: 1 passed, 0 failed

## Credential Status

- Gemini: credential present: yes
- Groq: credential present: yes

## Provider Calls

- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: recovery.secondary.matchJob
  Duration: 649ms
  Retry count: 0
  Fallback path: gemini: deliberate failure -> groq
  Token usage: unavailable

## Latency Results

- Primary provider failure recovers to secondary provider: 1074ms

## Failures Found

- None

## Fixes Applied

- Recovery gate now requires two real providers and rejects mock/static fallback as successful recovery.

## Remaining Known Issues

- None
