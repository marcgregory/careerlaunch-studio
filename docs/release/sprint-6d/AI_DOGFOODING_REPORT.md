# AI Dogfooding Report

- Date/time: 2026-07-13T10:32:24.250Z
- Environment: production
- Provider/model: groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant, groq/llama-3.1-8b-instant
- Credential presence: Gemini=yes, Groq=yes
- Commands run: npm run eval:dogfooding
- Pass/fail totals: 6 passed, 0 failed

## Credential Status

- Gemini: credential present: yes
- Groq: credential present: yes

## Provider Calls

- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-16.matchJob
  Duration: 756ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-16.generateCoverLetter
  Duration: 24435ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-17.matchJob
  Duration: 1207ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-17.generateCoverLetter
  Duration: 9977ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-18.matchJob
  Duration: 713ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-18.generateCoverLetter
  Duration: 6727ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-19.matchJob
  Duration: 12945ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-19.generateCoverLetter
  Duration: 7464ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-20.matchJob
  Duration: 17744ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-20.generateCoverLetter
  Duration: 1097ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-21.matchJob
  Duration: 4711ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-21.generateCoverLetter
  Duration: 6209ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable

## Latency Results

- Junior Frontend Developer: 25194ms
- Senior Backend Engineer: 11184ms
- WordPress Developer: 7440ms
- Marketing Specialist: 20409ms
- Graphic Designer: 18841ms
- Customer Support Specialist: 10920ms

## Failures Found

- None

## Fixes Applied

- Dogfooding gate now uses real provider matchJob and generateCoverLetter calls instead of deterministic pipeline fallbacks.

## Remaining Known Issues

- None
