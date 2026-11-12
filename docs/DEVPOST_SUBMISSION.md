# FlowPay AI — ready-to-copy submission

## Project title
FlowPay AI

## One-line tagline
Turn completed work into reviewed invoices and grounded overdue-payment follow-ups, without giving up control.

## Problem and audience
Solo freelancers, designers, consultants and small service businesses need to invoice finished work and follow up consistently without damaging client relationships. FlowPay does not claim measured business outcomes or predict whether a client will pay.

## Solution and what we built
A functioning responsive application, not a landing page: dashboard, searchable invoices, four-step invoice creation, editable invoice previews, client creation/history, activity log, business settings, real hosted AI invoice parsing and AI reminder drafting. Fictional sample data is explicitly marked Demo. Invoice data stays in the current browser.

## Innovation — why not just PayPal or QuickBooks reminders?
PayPal and QuickBooks already create invoices and send scheduled reminders. FlowPay focuses on the decision before a reminder: **which payment needs attention, why, and what is safe to do next.** The dashboard leads with the three highest-priority payments, each with amount, days overdue, "Why this?" reasons and the source of each fact.

- **Context-aware rules (not AI prediction):** lateness, balance, user-confirmed contact, and optional situations the user enters — payment promised (wait until the date), invoice disputed (resolve first, no reminders), contacted elsewhere (3-day cooldown).
- **Honest contact records:** approving or copying an AI draft is recorded as a *draft* and never counts as contact. Only an explicit "I sent this outside FlowPay" confirmation, with the user's timestamp and channel, is recorded — labelled self-reported, not verified — and only that triggers the cooldown. Legacy records from an earlier build are shown as unverified and ignored.
- **Genuine hosted AI** drafts invoice proposals and reminder wording; the ranking itself is deterministic and explained.

## Genuine AI workflow — verified November 12, 2026
The application calls `openai/gpt-6-astra` on the Lovable AI Gateway Responses surface, server-side, with strict JSON schema and post-validation. Workspace catalog explicitly included the model, with zero-retention Responses eligibility. A real request returned quantity 3, rate USD 120 and due in 14 days, displayed as a USD 360 editable proposal. Gateway log `01a1cf1a-1bca-74b5-8e44-a9bee0ec27ff` confirmed HTTP/upstream 200, streaming, SDK client, at 09:32:40 UTC. Browser tests repeated real parsing on desktop, 320px and 390px, and exercised reminder drafting.

AI status distinguishes configuration from a successfully validated response. Verification is scoped to the running server instance and resets after restart. A clearly labelled non-AI parser/template remains available on failure.

## PayPal workflow — implemented server core, NOT verified or submission-ready
The PayPal Invoicing REST API v2 sandbox core includes OAuth, payload validation, stable invoice numbers, idempotency request IDs, remote pre-send status checks and retrieval after send. No live-money endpoint exists.

Secure operator access now requires a server-verified owner code, an encrypted two-hour HttpOnly Secure SameSite=Strict cookie and HMAC invoice ownership proof scoped to that session, PayPal ID, local ID, content hash and expiry. Create/send/read and OAuth checks are protected. Send requires explicit approval. Rate caps and remote idempotency/status checks prevent uncontrolled public actions.

Neither `PAYPAL_CLIENT_ID` nor `PAYPAL_CLIENT_SECRET` nor `FLOWPAY_OPERATOR_PASSWORD` is configured, so no real sandbox authentication/create/send/retrieve/payment success is claimed. `FLOWPAY_SESSION_SECRET` was generated securely. Owner setup and a real sandbox verification remain Stage One blockers; demo sending is not PayPal.

## Tools and AI disclosure
Built with Lovable assistance; React 19, TanStack Start/Router, Tailwind CSS, shadcn/Radix primitives, Lucide, Zod, Lovable AI Gateway SDK and PayPal's public Invoicing REST API sandbox core. AI drafts can be wrong; every field is editable. Rule-based fallbacks are labelled non-AI. No PayPal logo is used. FlowPay AI is independent and is not affiliated with, sponsored by or endorsed by PayPal.

## How to test
1. Open Dashboard: sample financial figures are illustrative, not real results.
2. AI Assistant: enter `3 hours branding consultation at $120/hr for Alex due in 14 days` and generate. Confirm the AI badge, quantity/rate/date and USD 360 total.
3. Create draft & review. Review the preview and edit as needed.
4. Review & send: the send button stays disabled before approval. With current setup it is explicitly **Send (demo)**; nothing is emailed or created in PayPal.
5. Invoice detail: confirm Demo simulation and reload to verify browser persistence.
6. Open FP-1001 → Draft reminder → approve & copy. The suggestion stays "Draft a … reminder" (a draft is not contact). Then "Log a reminder I sent outside FlowPay" → confirm: suggestion becomes "Wait before following up". Set Client situation → Invoice disputed: suggestion becomes "Resolve the dispute". FP-1002 shows a demo promised date → wait.
7. Settings: inspect the actual AI verification and PayPal readiness. Judge-owned credential setup is in README.

## URLs — replace placeholders before submitting
- Current development preview: https://id-preview--75c9d915-0930-4ce1-8da9-f6e340bfccb8.lovable.app (not verified as public judge access).
- **PUBLIC DEPLOYED APP URL:** https://flowpay-ai-hackathon.lovable.app — signed-out homepage independently returned HTTP 200 and rendered FlowPay on Nov 12 around 09:45 UTC; new operator changes still require republishing.
- **PUBLIC SOURCE REPOSITORY URL: [REPLACE — public visibility not verified]**
- **PUBLIC YOUTUBE DEMO URL: [REPLACE — not recorded/uploaded]**

## Limitations
PayPal integration remains unverified; invoice actions require owner-code setup and session-bound signed ownership. The stateless operator gate is not multi-user accounts; logout cannot revoke stolen cookie copies globally, and access to old session invoices is not recoverable after login rotation. Rate caps are isolate-local, not distributed. FlowPay sends no reminder emails; external contact is self-reported and unverified. AI requests have best-effort per-client/global caps (isolate-local). Browser-local storage has no accounts or device sync and can be erased. Multi-tab edits are last-write-wins. PayPal totals, when enabled, may differ by a cent from previews. No webhooks; status requires refresh. Automated accessibility checks are not WCAG certification; assistive technologies, real devices, high contrast and 200% zoom remain unverified in this pass. Public AI requests currently have no per-user quota; review exposure/spending before publishing.

## Deadline
Official rules checked November 12: **November 12, 2026, 12:00 PM PST / 2:00 PM CST / 3:00 PM EST / 20:00 UTC**. Source: https://paypalaihackathon.devpost.com/rules. Stage One applies API/theme viability; Stage Two equally weights technological implementation, design, potential impact, innovation and idea, and quality of presentation.
## Verified values as of 2026-11-12 ~11:00 UTC
- **Live app (verified signed out):** https://flowpay-ai-hackathon.lovable.app
- **Source repository:** `<ADD PUBLIC GITHUB URL — not yet created/verified>`
- **Video:** `<ADD PUBLIC YOUTUBE URL — 2:42 recording exists locally, not yet uploaded>`
- **PayPal sandbox evidence:** none yet — credentials not configured; do not claim sandbox success in the submission until verified.
- **AI evidence:** real hosted structured invoice parsing, labelled in-app.