# CRM assistant

Open **CRM assistant** in the bottom-right corner of any workspace page.

- **Show daily briefing** checks tasks, tender deadlines and registration expiry through the next seven days, including overdue items. Managers and administrators also see outstanding invoice balances.
- **Show project risks** reports observed deadline, task dependency and budget concerns, with reasons. Budget checks are management-only and never mix currencies. These are observations, not predictions or a guarantee of project health.
- **Workspace actions and drafts** offers actual authorized projects, tenders, employees, customers, invoices and clean files from the selected workspace. Choose records to summarize work, propose tasks/checklists, draft customer emails or payment reminders, or analyze a document.
- **Follow-up questions** retain the last six exchanges and recent source references. The model is told to reread referenced records, clarify ambiguity and ask for missing task dates or assignees.
- **Document analysis** reads the current clean indexed document version, returning at most 12 chunks / 12,000 characters with available page/sheet references. The underlying index itself is limited to 40 chunks. Analysis must distinguish extracted requirements, suggested checklist items and missing evidence. A scanner and indexing are required; indexing existing verified text uses no embedding API unless one is separately configured. Scanned PDFs need OCR configuration.
- **Draft messages** stay in the conversation. Use **Copy** to review and send them yourself. The assistant does not send email or record invoice payments.
- **Saved conversations** (clock/history icon) restores available conversations owned by your account in the selected workspace. Current role, membership, retention expiry and source access are checked again. Old conversations without role provenance are unavailable. History restores text and citations; request a new action proposal rather than replaying old proposals.
- **Rate limits** display an estimated retry countdown from the provider's Retry-After header (60 seconds when absent). During provider throttling, exact CRM quick-answer buttons remain available. CRM request limits and monthly workspace message quotas still apply. Retrying once the timer ends may encounter another provider limit.

## Cost and boundaries

Exact **Show/List daily briefing**, **project risks**, **workspace overview**, **tenders**, **deadlines**, and **unpaid invoices** shortcuts do not call the chat model. Free-form conversation, drafts and document analysis use the configured provider quota. No paid plan is enabled by these features.

Briefing/risk scans check up to 500 authorized records per collection; sections show ten attention items and risk answers up to twenty projects. Answers disclose partial scans. Suggestions are limited to twelve choices from the first fifty accessible records per collection; exact names/IDs can also be entered in chat. History shows up to twenty available conversations from a bounded sample of one hundred account-owned conversations. Six exchanges are retained per chat, with the configured retention period (30 days by default).

Record mutations remain proposals, requiring confirmation, current permission checks and record-version conflict checks. No external message is sent automatically.

## Verification

Run frontend `npm run check` and backend `npm test` / `npm run lint` in `functions`. Tests use fake model providers. `node scripts/verify-local-assistant.mjs <local-admin-email>` exercises actual local callable endpoints, workspace suggestions, deterministic briefings/risks, persisted history and account/workspace denial checks without hosted AI calls.
