<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- App data (clients, invoices, activity, settings) lives in a browser-local store (`src/lib/store.tsx`, localStorage); no backend DB yet — keeps the demo self-contained.
- PayPal Invoicing calls happen only in `*.server.ts` via server functions, sandbox base URL only; send only after explicit UI approval and confirm status by reading the invoice back.
- AI calls use the Lovable AI Gateway SDK Responses stream with schema validation; operational status requires a completed validated response and is scoped to the running isolate.
- PayPal RPCs require a two-hour encrypted HttpOnly Secure SameSite=Strict operator cookie plus HMAC proof binding session, PayPal ID, local ID, content hash and expiry; a shared operator gate is not multi-user accounts.
- Sandbox identity/request IDs use server-computed content hashes scoped to session; existing drafts are immutable, read before send, and confirmed afterward to avoid duplicates.
- Isolate-local bounded rate caps and concurrent-action locks supplement CSRF/operator access; they are best-effort, not distributed quotas or global replay revocation.
- Pure business rules live in pure modules with unit tests in `src/test/`: totals/status (`money.ts`), recovery copilot prioritisation (`recovery.ts`), PayPal payload/status mapping (`paypal-payload.ts`), AI output sanitising (`ai-schema.ts`).
- PayPal writes must stay idempotent (PayPal-Request-Id + stable invoice_number) and send must check remote status first, to prevent duplicate invoices/sends.
- Form inputs, selects and dialogs get accessibility sizing (44px, focus rings, mobile-safe dialogs) from the shared `src/components/ui` primitives, not per-page overrides.

- Only explicit user-confirmed external contact (`reminder_confirmed_external`) or a "contacted elsewhere" circumstance counts as contact in `recovery.ts`; drafts and legacy `reminder_sent` never do — prevents false delivery claims.