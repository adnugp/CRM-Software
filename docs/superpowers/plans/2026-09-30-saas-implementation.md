# CRM SaaS Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for independent subsystems, then integrate and review the whole change.

**Goal:** Implement isolated tender/project workspaces, complete business workflows, and reviewed AI actions.
**Architecture:** React + Firebase Auth/Firestore/Storage; authenticated callable operations are the mutation boundary. AI uses the same operations. Hosted OpenAI-compatible and Ollama adapters are server-configured.
**Tech stack:** TypeScript, Firebase Functions, React, Node tests, Firebase emulator checks.
**Spec:** Approved in this conversation on 2026-09-30.

## Global constraints
- No production deployment, migration execution, email sending, or paid model calls during development.
- Preserve legacy data via explicit reviewed membership mapping and dry-run migration.
- Employees see assigned work; clients see explicitly shared records; finance restricted to managers/admins.
- Every AI write has a user/workspace/version-bound confirmation expiring in ten minutes.
- Manual SaaS billing; no payment gateway integration.

## Tasks
- [x] Backend: workspace/membership authorization, validated mutations, audit/versioning, transactional conversion, onboarding/invitations/manual entitlements, finance and renewal operations, rules.
- [x] AI: authenticated conversation, provider adapters, permitted tools, proposals/confirmation, citations, extraction/retrieval, limits/tests.
- [x] Frontend: workspace context/onboarding, secure service layer, CRUD integration, business feature screens, AI confirmations, document upload and notification settings.
- [x] Operations: migration dry-run/backup/rollback tooling, CI, environment setup, release/runbooks, import/report helpers.
- [x] Stabilize: frontend/backend type checks, lint/build, regressions and access tests.
- [x] Review: inspect subsystem diffs and whole-branch integration; fix findings and record remaining external prerequisites.

## Review focus
- Cross-workspace access via direct requests and document downloads.
- Revoked memberships and stale sessions/cache.
- Concurrent edits, conversion retries and duplicate AI confirmation.
- Mixed currencies, partial payments and date/timezone boundaries.
- Provider/document failures never disguised as real CRM data.

## Ledger
- Ruling: keep Firestore authoritative; archived Data Connect schema remains reference-only.
- Ruling: initial migration has one workspace and two configurable operating divisions.
- Ruling: implement in this existing isolated worktree on codex/saas-workspaces-ai-actions.

## Local implementation verification
- Frontend: typecheck, lint, production build and 17 tests passed.
- Functions: lint/build and 33 non-emulator tests passed; 2 domain tests passed in the emulator suite.
- Combined Auth/Firestore/Storage emulator suite: 10 tests passed, including migration/restore, rules, callable handlers and AI confirmation.
- Dependency audit: functions production dependencies have zero advisories; root has no high/critical advisories (10 moderate transitive/router advisories remain).
- Review fixed direct financial reads, forged document provenance, scan verdict rendering, existing-account invitation identity changes, private AI export inclusion, payment plan cap, task assignment validation, suspended account rules, stale workspace responses and fabricated report claims.
- Private conversations/proposals and AI caches are omitted from tenant exports. Storage reservations enforce the manual plan storageBytes limit.
- External release gates remain: real browser UI proof (local gstack browser executable blocked by Windows Application Control), production HTTP/auth middleware, real scanner/OCR/model/mail, staging deployment/schedule monitoring, explicit legacy mapping/apply and actual production recovery drill. No live service calls or production migration/deployment were executed. See docs/operations.md.
