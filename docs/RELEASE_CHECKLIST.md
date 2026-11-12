# Submission-day release evidence

Updated November 12, 2026, after the secure operator pass. Deadline: **12:00 PM PST / 2:00 PM CST / 3:00 PM EST / 20:00 UTC today**, confirmed from https://paypalaihackathon.devpost.com/rules.

| Check | Result | Evidence / next action |
|---|---|---|
| Workspace AI availability | PASS | Authenticated catalog returned `workspace_models: included`; `openai/gpt-6-astra` supports Responses and zero retention. |
| Real server-side structured invoice parsing | PASS | Gateway log `01a1cf1a-1bca-74b5-8e44-a9bee0ec27ff`, 09:32:40 UTC: HTTP/upstream 200, streaming SDK, 3477ms. UI returned 3 × USD 120, 14 days, USD 360. |
| Honest AI readiness | PASS | Configuration alone is not operational; completed schema-valid response sets instance-scoped verification; later failures clear readiness. |
| PayPal secrets | BLOCKER | Secret names listing contained neither `PAYPAL_CLIENT_ID` nor `PAYPAL_CLIENT_SECRET`. Add judge/owner sandbox values in Lovable Project Settings → Secrets. |
| PayPal OAuth | NOT VERIFIED | No credentials; no authentication request executed. Settings Test connection requires credentials plus operator unlock. |
| PayPal create → send → retrieve → pay | BLOCKER | Not executed. Secure operator/session-bound ownership path implemented; PayPal credentials and owner access code are absent. |
| Sandbox-only endpoints | PASS (source) | `paypal.server.ts` uses only `https://api-m.sandbox.paypal.com`; no live-money endpoint. |
| No unauthenticated invoice actions | PASS (security tests) | Create/send/read require an unexpired operator cookie; send/read additionally require matching signed ownership. CSRF remains in Start; it is not treated as authorization. |
| Fresh automated build/typecheck | PASS | Harness `build OK` at 09:46:33 UTC after secure operator changes. No manual build was run. |
| Unit/integration rules tests | PASS | Secure-operator suite covers expiry, cookie config, ownership, denial, rate windows, concurrency and mocked duplicate-send behavior; final count below. |
| Required page renders | PASS | `/`, `/assistant`, `/invoices/new`, `/settings` at 1280, 320 and 390px. One main H1 each; no runtime page errors. |
| Responsive overflow | PASS | No horizontal document overflow on all 12 page/viewport combinations. |
| Automated accessibility | PASS (limited) | axe-core 4.10.3 WCAG 2/2.1/2.2 A/AA tags: zero violations on those 12 initial page states. Not certification. |
| Real AI → draft → approval → demo send → persisted detail | PASS | Browser regression at all three widths; asserts quantity 3, rate 120, 14 days; keyboard Enter/Space; send disabled before approval; reload confirms simulation state. |
| Four-step manual wizard | PASS | Client validation state, keyboard selection, line items, terms, review and Save draft exercised at all widths. |
| P0 reminder integrity | PASS | Approve & copy logs `reminder_draft_approved`; suggestion stays "Draft a firm reminder" (browser, 320/390/430/1280). Explicit external confirmation → "Wait"; dispute → "Resolve". Unit tests cover drafts, legacy `reminder_sent`, user timestamp. |
| Client situations (promised/disputed/contacted) | PASS | 5 unit tests + browser flow; persisted in browser storage. |
| Mobile Home/Invoices/AI/More | PASS | More sheet opens, Escape closes; no horizontal overflow at 320/390/430. |
| Automated axe (wcag2a/aa, 2.1aa, 2.2aa) | PASS | 0 violations on dashboard and invoice detail at 4 widths, activity at 1280. Not certification. |
| AI request caps | IMPLEMENTED | 8/min and 40/hour per client IP, 400/hour global, isolate-local; not load-tested. |
| PayPal sandbox create/send/read | BLOCKED | PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, FLOWPAY_OPERATOR_PASSWORD not configured as of Nov 12 10:20 UTC. |
| Screen reader, 200% zoom, high contrast, real-device safe areas | NOT VERIFIED | Automated browser and axe checks do not establish these. Perform manual checks before claiming full WCAG conformance. |
| Independent branding | PASS (source/UI) | No PayPal logo; Settings and desktop shell state independent/not affiliated. |
| Public app URL / signed-out homepage | PASS (existing deployment) | Published at https://flowpay-ai-hackathon.lovable.app. Independent signed-out browser check returned HTTP 200 and rendered FlowPay at approximately 09:45 UTC. New operator changes require republishing. |
| Public repository and visible MIT license | BLOCKER | Root `LICENSE` exists with MIT terms; public repository visibility and detectable GitHub About license have not been verified. |
| Public YouTube demo under 3 minutes | BLOCKER | Script prepared; recording/upload/public playback not completed. |
| Devpost fields and URLs | BLOCKER | Copy submission text, replace all URL placeholders and submit before 20:00 UTC. |

## Honest release verdict
Real AI and demo workflows are verified. **Not ready to claim a verified PayPal integration or Stage One eligibility.** Sandbox credentials, owner access-code setup, full sandbox verification, public repo/video and final Devpost submission remain outstanding.

## Revision handling
Code and documentation are saved in the current project. Lovable manages revision creation; no manual Git commit was executed. Latest observed platform revision before this evidence update: `ceb8a09` (`Changes`). Subsequent evidence/test updates may create a later revision automatically.

## Privacy
Evidence contains only model identifiers, timestamps, log IDs, fictional invoice values and nonsecret configuration presence. Never include secret values, token fragments, headers or Secrets screenshots.
## Secure operator pass evidence
- Generated `FLOWPAY_SESSION_SECRET` through secure secret generation; value was never displayed. Owner must add `FLOWPAY_OPERATOR_PASSWORD` (16+ characters), `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
- Cookie config: encrypted two-hour HttpOnly Secure SameSite=Strict; client session headers disabled; proof binds session, invoice, content and expiry.
- Automated tests cover unauthenticated denial with configured PayPal mocks, cross-session proof/send/read denial, tamper/expiry, explicit approval, rate windows, concurrency and remote double-send idempotency. All remote API tests are mocked, **not real PayPal verification**.
- Real browser at 1280/320/390px: absent owner-code setup denied unlock, cleared password input, preserved keyboard-approved demo send, no horizontal overflow or runtime page errors. A genuine configured unlock/cookie/read-back flow remains unverified until the owner supplies the access code.
- Limits are per server isolate; stateless cookies cannot globally revoke stolen copies before expiry. Logout clears the browser cookie; new login rotates identity and cannot recover old invoice proofs. No database or multi-user account system was added.

## Five-pass audit evidence (2026-11-12, 10:27–10:50 UTC)
See `docs/FIVE_PASS_AUDIT.md`. 49/49 unit tests and 178/178 scripted browser cases pass after 10 fixes (local preview, Chromium). axe WCAG 2.2 A/AA: 0 violations on audited routes and dialogs (automated only, no AT testing). PayPal sandbox: **BLOCKED** (secrets absent, no call made). Public repo/MIT, YouTube, Devpost: **BLOCKED** (not done/verifiable here).

## Final submission pass (2026-11-12, ~10:51–11:00 UTC)
| Item | Status | Evidence |
|---|---|---|
| Live public app serves five-pass fixes | **PASS** | Published from revision `5c0b653`; signed-out Chromium on https://flowpay-ai-hackathon.lovable.app at 320/390/1280: all 7 routes HTTP 200, 0px horizontal overflow, no page errors; new "FlowPay never emails reminders" copy present |
| PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / FLOWPAY_OPERATOR_PASSWORD | **BLOCKED — absent** | Secret-name check only. No PayPal call made. |
| Real PayPal sandbox create → send → retrieve | **BLOCKED** | Needs the three secrets above |
| Real hosted AI | PASS | Structured parsing observed again in the recorded demo |
| Public GitHub repo with MIT LICENSE | **BLOCKED — owner action** | `LICENSE` (MIT) is at the repo root in the source. The agent cannot connect Git sync or create/publicise a repo. A clean source ZIP was produced as a fallback. |
| Demo video < 3 min | **Recorded, NOT on YouTube** | `flowpay-ai-demo.mp4`, 2:42, real app capture (desktop 1280 + phone 390), demo mode only — no PayPal sandbox footage. Must be uploaded to YouTube (Public) by the owner. |
| Devpost submission | **BLOCKED — owner action** | No authenticated Devpost access available to the agent |