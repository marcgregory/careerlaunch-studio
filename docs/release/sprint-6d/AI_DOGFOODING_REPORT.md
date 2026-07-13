# AI Dogfooding Report

- Date/time: 2026-07-13T09:40:24.154Z
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
  Duration: 770ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-16.generateCoverLetter
  Duration: 791ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-17.matchJob
  Duration: 7106ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-17.generateCoverLetter
  Duration: 698ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-18.matchJob
  Duration: 858ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-18.generateCoverLetter
  Duration: 10276ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-19.matchJob
  Duration: 2953ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-19.generateCoverLetter
  Duration: 5913ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-20.matchJob
  Duration: 10972ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-20.generateCoverLetter
  Duration: 8944ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-21.matchJob
  Duration: 1732ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable
- Provider: Groq
  Model: llama-3.1-8b-instant
  Credential present: yes
  Operation: resume-21.generateCoverLetter
  Duration: 6153ms
  Retry count: 0
  Fallback path: none
  Token usage: unavailable

## Latency Results

- Junior Frontend Developer: 1561ms
- Senior Backend Engineer: 7804ms
- WordPress Developer: 11134ms
- Marketing Specialist: 8868ms
- Graphic Designer: 19916ms
- Customer Support Specialist: 7885ms

## Failures Found

- None

## Fixes Applied

- Dogfooding gate now uses real provider matchJob and generateCoverLetter calls instead of deterministic pipeline fallbacks.

## Remaining Known Issues

- None
