# FlowPay AI

> **Recovery copilot integrity:** approving/copying a reminder draft is never recorded as contact. Only an explicit, self-reported "I sent this outside FlowPay" confirmation (or a "contacted elsewhere" situation) pauses follow-ups for 3 days. Optional per-invoice situations — promised, disputed, contacted elsewhere — change recommendations. FlowPay sends no reminder emails.

**Go from completed work to payment with AI help — without losing control.**

Built for the PayPal AI Hackathon 2026. FlowPay AI helps solo freelancers, designers, consultants and small service businesses turn finished work into invoices and follow up on overdue payments politely.

> FlowPay AI is an independent project. It is **not affiliated with, sponsored by, or endorsed by PayPal**. It uses PayPal's public Invoicing REST API in the **sandbox (test) environment only**. No real money is ever processed.

## Why

QuickBooks' 2026 Late Payments Report: 59% of surveyed small businesses report invoices overdue 30+ days; affected businesses carry a $17.7K average overdue balance; 74% have not fully automated bill pay. (Cited from the report; FlowPay makes no claims about its own impact.)

## Features

- **Dashboard** — awaiting payment, overdue, collected, plus prioritised next actions. Seeded sample data is labelled "Demo".
- **Invoices** — search, filter by status, sort; accessible table on desktop, cards on mobile.
- **Create invoice wizard** — client → line items (tax, discount, live totals) → terms/due date → review with live preview. Save draft any time.
- **AI invoice assistant** — describe work in plain language (e.g. *"3 hours branding consultation at $120/hr for Alex due in 14 days"*). The AI returns a structured proposal with extracted assumptions and editable fields.
- **Overdue payment recovery copilot** — ranks open invoices by days late, balance size and your last contact; recommends one next action (send reminder, wait, review & send) with a plain-language "Why this?" explanation. Rules are transparent and grounded only in your invoice and activity data (`src/lib/recovery.ts`); no predictions about whether a client will pay.
- **AI reminder drafts** — tone suggested by the copilot (friendly → firm → final, based on lateness and reminders already sent; "wait" within 3 days of the last contact). Fully editable, regenerate, copy, explicit approval required. Never auto-sent. Reminder email delivery is not connected: approving records the reminder in the activity log.
- **Clients** — list, create, invoice history and outstanding balance.
- **Activity log** — every create, send, PayPal event, error and reminder.
- **Settings** — business profile, demo data controls, PayPal sandbox and AI status.

## PayPal sandbox integration

**Submission-day status (Nov 12, 2026):** secure sandbox operator access is implemented. Neither PayPal credential nor the owner access code is configured, so real PayPal calls remain **blocked and unverified**. An unlocked operator session and signed session-bound invoice proof are required; public callers cannot create, send or retrieve invoices. Demo sends remain explicitly simulated. This shared operator gate is not multi-user accounts.

All PayPal calls run **server-side** (`src/lib/paypal.server.ts`, exposed through server functions in `src/lib/paypal.functions.ts`). Credentials are read from environment secrets and never sent to the browser.

Authorized operator flow, available only after secure setup:

1. `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` (client credentials) → access token.
2. `POST /v2/invoicing/invoices` → draft invoice; the returned ID is stored on the invoice.
3. `POST /v2/invoicing/invoices/{id}/send` — **only after explicit user approval**.
4. `GET /v2/invoicing/invoices/{id}` — the status is read back; FlowPay only shows "sent" when PayPal confirms `SENT`/`UNPAID`/`PAID`.

Safety and consistency:

- **Idempotency** — `PayPal-Request-Id` on create (derived from server-computed session/local/content identity) and send; PayPal `invoice_number` is stable per operator session, local invoice and content, so retries never create duplicates.
- **No duplicate sends** — the server reads the invoice before sending; if PayPal already reports `SENT`/`UNPAID`/`PAID`…, it syncs instead of re-sending. The client also blocks double-clicks and only allows sending drafts.
- **Edits after a PayPal draft** — an existing remote draft is immutable through this app. Changed content is rejected; restore its original fields or create a separate local invoice.
- **Stale status** — "Refresh PayPal status" maps `PAID`/`MARKED_AS_PAID`/`CANCELLED`/`REFUNDED` etc. back to the local status and records when it was last checked. There is no webhook, so status updates only on refresh.
- **Validation** — server functions validate all inputs with zod (USD only, dates, email, amounts, item limits). Access tokens are cached per server instance and refreshed early.

Errors (auth, validation, network) are shown in the dialog, logged to the activity feed, and the invoice stays a draft (retrying reuses the PayPal draft ID). The invoice page offers **Refresh PayPal status** to pick up payments made in the sandbox.

### Setup

1. Go to <https://developer.paypal.com/dashboard/applications/sandbox> and create a sandbox REST app.
2. For a Lovable-hosted copy, add **your own sandbox** values in **Project Settings → Secrets** as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Never paste credentials into chat or commit them.
3. Set `FLOWPAY_OPERATOR_PASSWORD` to a strong, unique access code of at least 16 characters in **Project Settings → Secrets**. `FLOWPAY_SESSION_SECRET` was generated securely by Lovable; never display or share it. For a separate judge-hosted copy, generate its own session secret with the secure secret-generation tool.
4. Publish after adding secrets for the published app to use them (preview uses updated secrets immediately). Open app **Settings → Sandbox operator access**, enter the owner code, then **Test connection**. OAuth success is not invoice-delivery verification.
5. Enable **Send through PayPal sandbox**, use a sandbox buyer account controlled by the tester, review an invoice and explicitly approve send. The send dialog also offers operator unlock; it never silently substitutes demo when sandbox is selected but locked.
6. For a local judge setup, clone the public repository (URL must be supplied), run `bun install`, then `bun run dev`. Supply all four values (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `FLOWPAY_OPERATOR_PASSWORD`, `FLOWPAY_SESSION_SECRET`) through the local process environment, e.g. export them securely in your shell; do not put them in source control. Open the local URL printed by Vite.
7. Hosted AI requires the server's managed `LOVABLE_API_KEY` in a Lovable-hosted copy. Local standalone clones without Gateway configuration use the explicitly labelled non-AI fallback; real AI is not claimed there.
8. Full sandbox testing requires an unlocked operator and a sandbox buyer account controlled by the tester. Never use real customer emails. Explicitly approve send, retrieve its status, pay only in sandbox, and retrieve again before claiming payment.

Without these secrets the app runs in clearly labelled **DEMO MODE**: the full workflow works, but "sending" is simulated locally.

Docs: <https://developer.paypal.com/api/invoicing> · <https://developer.paypal.com/invoicing/use-cases/>

## AI tool disclosure

- In-app AI uses a hosted large language model (`openai/gpt-6-astra`) via the Lovable AI Gateway, called from a server function with structured (schema-validated) output. AI output is always shown for review and editing; nothing is sent automatically.
- If hosted AI is unavailable, a rule-based parser and email templates are used and **labelled "Demo simulation (not AI)"**.
- This application was built with the help of Lovable, an AI app builder.

AI output is post-validated on the server (`sanitizeParsed`): numbers clamped to safe ranges, invalid emails dropped, max 20 items, assumptions trimmed. Ambiguous client names (e.g. "Alex" when two Alexes exist) are never auto-matched.

## Demo data

Clients and invoices seeded on first load are fictional and tagged "Demo". Figures on the dashboard are illustrative and are **not real financial results**. Reset or clear them in **Settings → Demo data**. App data is stored in your browser (localStorage).

## Accessibility (WCAG 2.2 AA target)

Skip-to-content link, semantic landmarks (`nav`, `main`, headings), visible focus rings, 44px minimum touch targets, real `<label>`s for every input (no placeholder-only labels), inline error messages linked with `aria-describedby`, a polite live region announcing results, Radix-based accessible dialogs, status badges with icon + text (never colour alone), focus moved to each wizard step heading, `prefers-reduced-motion` respected, layouts tested down to 320px.

Automated checks run during development: axe-core (WCAG 2.0/2.1/2.2 A+AA rules) on every page at 320px and 1280px with zero violations after fixes, and no horizontal scrolling at 320px. This is **not** an AA certification: manual screen-reader testing (VoiceOver/NVDA/TalkBack), 200% browser zoom, Windows high-contrast mode and real-device safe-area checks have **not** been done.

## Judging walkthrough (≈2 minutes)

1. **Dashboard** — note the demo banner and the overdue priorities.
2. **AI Assistant** — click the first example, **Generate invoice proposal**, review assumptions, edit a rate.
3. **Create draft & review** — lands on the wizard's Review step with a live preview.
4. **Review & send** — tick the approval box; sends via PayPal sandbox (if connected) or demo simulation.
5. **Invoice page** — see channel, PayPal ID/status, history; click **Refresh PayPal status**.
6. **AI Assistant → Overdue follow-ups → Draft reminder** — switch tone, edit, approve.
7. **Activity** and **Settings** — full audit trail and integration status.

## Status report — what's real, what's not

| Area | Status |
|---|---|
| Hosted AI (invoice parsing, reminder drafts) | **Working**, verified with live requests in this environment |
| PayPal sandbox create → send → refresh | **Secure operator + signed ownership implemented, NOT verified against PayPal** — owner access code and sandbox credentials required |
| Reminder emails | **Simulated** (recorded only); no email provider connected |
| Payments | None. Sandbox only; no live PayPal endpoint exists in the code |
| Data storage | Browser localStorage only — no accounts, no sync between devices, clearing the browser erases data |

### Hackathon submission blockers (per official rules)

1. **PayPal sandbox credentials and operator access** — add `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `FLOWPAY_OPERATOR_PASSWORD`, unlock the operator, and run a full create → send → pay (with a sandbox buyer account) → refresh cycle. Stage One requires the PayPal integration to genuinely work.
2. **Public repo with detectable license** — push to public GitHub; the `LICENSE` (MIT) file must show in the repo "About" section.
3. **Demo video under 3 minutes** on YouTube, showing the sandbox flow end-to-end.
4. **Judge access** — a deployed URL, or setup instructions including how judges supply their own sandbox credentials (secrets must not be committed).
5. Deadline verified from official rules: **Nov 12, 2026, 12:00 PM PST / 2:00 PM CST / 3:00 PM EST / 20:00 UTC**.

## Submission documents and fresh evidence

- [Devpost ready-to-copy submission](docs/DEVPOST_SUBMISSION.md)
- [150-second demo script](docs/DEMO_SCRIPT.md)
- [Release checklist: passes, unverified checks and blockers](docs/RELEASE_CHECKLIST.md)
- [Five-pass audit: test matrix, defects, fixes and evidence](docs/FIVE_PASS_AUDIT.md)

On Nov 12, a real server-side `openai/gpt-6-astra` Responses call returned a validated invoice proposal (3 × USD 120, due in 14 days). Gateway log `01a1cf1a-1bca-74b5-8e44-a9bee0ec27ff` confirmed HTTP/upstream 200 at 09:32:40 UTC. The updated integration uses the Lovable AI Gateway SDK with streaming strict JSON schema, not a simulated result. Settings now separates configured from operational; verification is scoped to the running server and resets on restart. Desktop, 320px and 390px browser checks covered real AI → review → approved demo send → persisted invoice detail, the manual wizard and reminder approval/cooldown. Initial requested pages had zero axe A/AA violations and no horizontal overflow. Manual screen-reader/zoom/real-device checks remain unverified.

### Known risks

- A PayPal sandbox app must have **Invoicing** enabled; otherwise sends fail with 403 (shown clearly in the UI).
- Tax is applied per line by PayPal; with discounts, PayPal's computed total may differ by a cent from the preview. The PayPal-confirmed amount is authoritative.
- If two browser tabs edit the same data, last write wins.
- AI output can be wrong; every field is editable and assumptions are listed, but users must review.

## Development

```bash
bun install
bun run dev
bun run test   # totals, overdue status, recovery rules, PayPal payload/status mapping, AI output validation, client matching
```

Stack: TanStack Start (React 19), Tailwind CSS v4, shadcn/ui, Lovable AI Gateway SDK.

## License

MIT License

Copyright (c) 2026 FlowPay AI contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Operator security and limits

The owner code is compared server-side using equal-sized SHA-256 digests. A two-hour encrypted HttpOnly Secure SameSite=Strict cookie holds a random operator identity; client session headers are disabled. A signed ownership proof binds that identity to the PayPal invoice ID, local invoice ID, server-computed SHA-256 content hash and expiry. The proof alone grants no access without the corresponding cookie. Send requires explicit approval and reads the remote state before/after; ID-only access is rejected.

The gate is for a trusted sandbox operator, not separate user accounts. Reloads retain access until expiry. Lock/logout or a new login invalidates access to prior proofs in that browser; old invoices cannot be adopted by entering the code again. No cross-session recovery is offered. A copied valid cookie plus proof can be replayed until expiry; stateless logout cannot revoke copies globally. Rotate the session secret to invalidate all sessions. Never share cookies/proofs, and keep this test flow sandbox-only.

Isolate-local limits: 5 unlock attempts per IP and 20 globally per 15 minutes; 20 actions per session and 100 globally per minute; 10 create requests/session/hour (30 globally), 20 send requests/session/hour (60 globally). Concurrent operator actions are rejected within the running instance; PayPal request IDs and stable numbers guard repeats across instances. These counters reset on server restart and are not a distributed quota.

Published app: https://flowpay-ai-hackathon.lovable.app — signed-out homepage independently returned HTTP 200 and rendered FlowPay on Nov 12 around 09:45 UTC. This proves public homepage access, not that the new operator changes have been republished. No publication was requested in this pass.