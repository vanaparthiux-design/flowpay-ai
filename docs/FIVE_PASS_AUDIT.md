# FlowPay AI — Five-Pass Audit (Nov 12, 2026)

**Base revision:** `706ca72` → fixes applied in this pass (see "Changed files"). Final SHA is the revision Lovable saves after this pass.
**When:** 2026-11-12, 10:27–10:50 UTC. **Where:** local dev preview (`localhost:8080`) in headless Chromium (Playwright), plus Vitest unit suite. Public URL was verified separately earlier the same day (HTTP 200, new dashboard live, More menu fixed by hiding the Lovable badge).
**Not used:** real phones/tablets, screen readers (NVDA/JAWS/VoiceOver/TalkBack), Windows High Contrast, real browser zoom UI. Zoom/reflow was approximated by CSS viewport width (1280px @200% ≈ 640px, @400% ≈ 320px). Forced-colors was emulated in Chromium only. **This is not a WCAG certification.**

## Test-case matrix (honest counts)

| Round | Method | Cases | First run | After fixes |
|---|---|---|---|---|
| 1 Visual/UX | 7 routes × 8 widths (320/375/390/430/768/1024/1280/1440) horizontal-overflow check + screenshots at 320/390/768/1280 manually reviewed | 56 overflow + visual review | 56/56 overflow pass; 2 visual defects found by eye | 56/56; visual defects fixed |
| 2 Functional journeys | Scripted browser journeys (390px), isolated fresh localStorage, fictional data | 32 | 29 pass / 3 fail (1 real defect, 2 test-script issues) | 32/32 |
| 3 Accessibility | axe-core 4.10 WCAG 2.0/2.1/2.2 A+AA on 7 routes @320 & @1280, invoice detail (draft+overdue), Reminder/Send/Client dialogs incl. error states, wizard error; target-size, accessible-name, reflow @200%/400%, reduced-motion, contrast; keyboard trap/Esc/focus return | 66 (in R1 script) + 14 (R3/4 script) | 10 + 4 fail | 0 fail |
| 4 Reliability/security/perf | Vitest suite; console/page-error capture on every route/width; 404/invalid id; corrupt storage; 1000-invoice list; secret-string scan; double-click send | 49 unit + 10 browser | 45 unit before new tests; all browser pass except 1 false-positive secret regex (matched "flask-conical") | 49/49 unit; browser pass |
| 5 Final re-review | Full rerun of rounds 1–4 scripts after all fixes | 178 browser + 49 unit | — | **227/227 pass** |

## Defects found

| # | Sev | Defect | File | Repro | Status |
|---|---|---|---|---|---|
| D1 | P1 | Invalid/garbled "When did you send it?" value crashed `toISOString()` (RangeError) when logging external contact; no lower bound (year 0001 accepted) | `src/components/app/ReminderDialog.tsx` | Open Draft reminder → Log a reminder I sent → clear/garble date → Log | **Fixed**: `isValidContactTime` (not future, ≤1 year old), button disabled, inline error with `aria-invalid` + `aria-describedby` |
| D2 | P1 | Contact date used UTC slice of timestamp; in UTC+ zones a same-morning contact counted as "1 day ago" (cooldown ended a day early). Corrupt stored dates produced NaN | `src/lib/recovery.ts` | Log contact at 08:00 local in UTC+10 | **Fixed**: `localDateOf()` converts to local calendar date; invalid dates ignored |
| D3 | P1 | Corrupted/partial saved data (e.g. `invoices:"bad"`) could crash the app on load | `src/lib/store.tsx` | Set bad JSON shape in localStorage, reload | **Fixed**: defensive array/number hydration (J12 passes) |
| D4 | P1 | Esc/close of Reminder and Send dialogs dropped keyboard focus to `<body>` instead of the opener (WCAG 2.4.3) | `ReminderDialog.tsx`, `SendDialog.tsx`, new `src/lib/use-return-focus.ts` | Focus "Draft reminder" → Enter → Esc → Tab | **Fixed**: focus returns to "Draft reminder"/"Review & send" (K2/K3 pass) |
| D5 | P1 | Tone radios, approval checkboxes and 6 dropdowns had no computed accessible name per axe `button-name` (labels wrapped but not associated) | `ReminderDialog.tsx`, `SendDialog.tsx`, `CircumstancePanel.tsx`, `invoices.index.tsx`, `invoices.new.tsx`, `activity.tsx` | axe on dialogs / /invoices / /activity | **Fixed** via `aria-labelledby`; axe 0 violations |
| D6 | P2 | Duplicate client email allowed | `src/components/app/ClientDialog.tsx` | Add two clients with same email | **Fixed**: inline error |
| D7 | P1 (trust) | Client dialog said "Invoices and reminders are sent to this email" — implied FlowPay emails reminders | `ClientDialog.tsx` | Open Add client | **Fixed**: "FlowPay never emails reminders for you — you send those yourself." |
| D8 | P2 | 320px header: logo wrapped "FlowPay / AI", "Demo / mode" wrapped; sample-data banner cramped | `Logo.tsx`, `AppShell.tsx`, `routes/index.tsx` | Screenshot @320 | **Fixed**, 0px overflow @320/375 |
| D9 | P3 | "View all", "Manage demo data", client email links < 44px tall (pass AA 24px, failed project 44px goal) | `routes/index.tsx`, `routes/clients.tsx` | target script | **Fixed** (min-h-11) |
| D10 | P1 (published only) | Lovable "Edit with Lovable" badge intercepted taps on mobile More button | publish setting | Tap More @320 on public URL | **Fixed** (badge hidden; verified by tap) |

Unresolved: none found by these tests. Untested areas listed below.

## Round 2 journey evidence (all PASS after fixes)
Dashboard leads with "Payments needing attention" + "Why this?" provenance · wizard blocks Next without client with announced error · 3×$100, $30 discount, 10% tax → $300 subtotal/$27 tax shown · Save draft persists and survives reload · send disabled until approval checkbox · dialog says Demo/no email/no PayPal · double-clicked demo send recorded once, channel `demo` · **real hosted AI** proposal labelled "AI · high confidence", $180 for "2 hours … $90/hr" · reminder dialog has no "Send reminder" verb · Approve disabled until reviewed · Approve & copy logs only `reminder_draft_approved` · future contact date rejected · dashboard still recommends reminder after approval (no cooldown) · explicit external contact logs `contactAt` + channel + "self-reported" → "Wait before following up" · dispute → "Resolve the dispute" · injected legacy `reminder_sent` does not trigger wait · client create; duplicate email blocked · search no-match empty state · More sheet: keyboard open, Esc closes with focus back on More, outside click closes, link navigates · Start empty → empty dashboard; Reset demo → 8 invoices · corrupted storage no crash · zero page errors.

## Round 3/4 detail
Skip link first Tab → focus `main`; ReminderDialog focus trapped over 40 Tab + 10 Shift+Tab; first invalid field focused in client form; live regions present; reduced-motion max animation 0s; axe color-contrast 0 failures on home @1280; reflow 0px overflow at 640px and 320px for all routes. 1000-invoice list: /invoices rendered in 4.19s on the **dev server** (unminified; not a production metric), search 0.26s, dashboard 0.93s. Unknown route → 404 page; unknown invoice id → handled message. PayPal security: covered by unit tests (`operator-security`, `paypal-access`, `paypal-idempotency`: unauthenticated create/send/read denied even with credentials, cross-session proof rejected, duplicate send idempotent). Build log: "build OK".

**Secrets (names only):** `PAYPAL_CLIENT_ID` absent, `PAYPAL_CLIENT_SECRET` absent, `FLOWPAY_OPERATOR_PASSWORD` absent. **No PayPal call was made. Mocked unit tests are not real PayPal verification.**

## Round 5 — hackathon re-review
All D1–D10 retested after fixes: PASS. All 7 routes + invoice detail rechecked at 8 widths.

| Devpost requirement | Status |
|---|---|
| Meaningful working AI | **PASS** — real hosted structured parsing observed this round |
| Meaningful working PayPal sandbox | **BLOCKED** — credentials + operator password not configured; flow is built and security-gated but unverified |
| Public GitHub repo + visible MIT license | **BLOCKED/unverified** — not checkable from here |
| Public YouTube demo < 3 min | **BLOCKED** — not recorded |
| Judge access | PASS — published URL loads signed out |

**Simulated 10-judge panel (opinion, not a prediction):**
| Criterion | Score /5 | Rationale |
|---|---|---|
| Technical implementation | 3 | Solid security design, tests, real AI; PayPal sandbox never exercised live — major gap for this hackathon |
| Design | 4 | Clear action-first hierarchy, consistent brand, accessible, responsive 320–1440 |
| Potential impact | 3.5 | Real pain point; honest copilot; limited by browser-only data and no email |
| Innovation | 3.5 | Explainable, circumstance-aware recovery and delivery-honest contact tracking differ from stock reminders; core AI use is modest |
| Presentation | 2.5 | Docs strong; video not yet recorded |

**Verdict:** Demo-ready and honest; **not submission-complete** until PayPal sandbox is verified live, repo is public with MIT, and the video is published.

## What each round really covered
- R1: overflow at 8 widths (full); visual review by eye on 4 widths × 7 routes (partial — not pixel-diffed, not 375/430/1024/1440 screenshots).
- R2: 32 scripted cases at 390px only (partial for other widths); invoice *edit* of an existing draft and delete invoice not scripted.
- R3: automated + keyboard (good coverage); **no real assistive technology**, zoom emulated by viewport.
- R4: unit + browser; no AI cancel/abort test, no network-failure injection, no production-build perf profile, no live CSRF test (unit only).
- R5: full rerun of all scripts after fixes.

## Changed files
`src/lib/recovery.ts`, `src/lib/store.tsx`, `src/lib/use-return-focus.ts` (new), `src/components/app/ReminderDialog.tsx`, `SendDialog.tsx`, `ClientDialog.tsx`, `CircumstancePanel.tsx`, `AppShell.tsx`, `Logo.tsx`, `src/routes/index.tsx`, `clients.tsx`, `invoices.index.tsx`, `invoices.new.tsx`, `activity.tsx`, `src/test/audit-regressions.test.ts` (new), docs.