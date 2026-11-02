# Security Policy

ResearchLoom (Samhita) takes security, privacy of local research vaults, and credential integrity seriously.

## Supported Versions

We actively provide security patches and updates for the following releases:

| Version | Supported          |
| ------- | ------------------ |
| 4.3.x   | :white_check_mark: |
| 4.2.x   | :x:                |
| < 4.2.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data leakage risk within ResearchLoom:

1. **Do not create a public GitHub issue.**
2. Report the vulnerability privately via **[GitHub Security Advisories](https://github.com/sohamsans/researchloom/security/advisories/new)** or by emailing the project maintainer directly.
3. Include the following details in your report:
   - Type of issue (e.g., buffer overflow, arbitrary file read, BYOK key exposure, insecure IPC bridge).
   - Component affected (Backend FastAPI, Frontend React/Capacitor, Android Stylus Bridge, SQLite vault).
   - Step-by-step reproduction instructions or proof-of-concept.
   - Any recommended remediation.

## Response Timelines

- **Initial Acknowledgement**: Within 24–48 hours.
- **Triage & Assessment**: Within 72 hours.
- **Patch Release & Security Advisory**: Issued within 7–14 days depending on vulnerability severity.

## Scope & Architectural Principles

- **Zero Remote Data Exfiltration**: ResearchLoom does not collect telemetry, analytics, or user documents. All research papers, notes, and vector indices reside exclusively on your local filesystem and SQLite vault.
- **BYOK (Bring Your Own Key) Protection**: All user-provided AI keys (Gemini, Groq, OpenRouter, Claude, OpenAI) are strictly stored in local secure storage (or environment variables) and are never logged or proxied to third-party servers.
