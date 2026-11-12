# FlowPay AI demo script — 2 min 45 s (165 s)

Record the real application with fictional demo data only. Never show Secrets, tokens, cookies or network headers. Final video must be **under 3 minutes** and public on YouTube.

**Story:** PayPal and QuickBooks already create invoices and send automatic reminders. FlowPay answers a different question: *which unpaid invoice needs me today, why, and what is the safe next step?* — with honest records of what actually happened.

| Time | On screen | Narration |
|---|---|---|
| 0–15s | Dashboard, "Payments needing attention" | “Invoicing tools already create invoices and fire off reminders. FlowPay AI is a recovery copilot: it tells a freelancer which payment needs attention, why, and the safe next step. Independent project, not a PayPal app; figures are fictional demo data.” |
| 15–35s | Expand **Why this?** on Priority 1 (FP-1001) | “Ranking is transparent rules — days late, balance, confirmed contact and situations I entered — not an AI guess. Every reason and its source is shown.” |
| 35–50s | Invoices → FP-1002 (Priya, promised) | “Here I recorded that the client promised to pay Friday. The copilot says wait — no aggressive reminder before the promised date.” |
| 50–80s | FP-1001 → Draft reminder; AI badge; edit text; tick approval; **Approve & copy draft** | “Hosted AI drafts the wording from this invoice. I edit and approve it. FlowPay has no email delivery, so this is saved as a *draft* — and the suggestion doesn't change, because copying isn't contacting.” |
| 80–100s | **Log a reminder I sent outside FlowPay**, date, channel, confirm | “Only after I actually send it from my own email do I confirm it. It's logged as self-reported, with my timestamp, and now the copilot says wait three days.” |
| 100–115s | Client situation → **Invoice disputed** → Save | “If the client disputes the invoice, reminders pause and the copilot suggests resolving the disagreement first.” |
| 115–140s | AI Assistant: `3 hours branding consultation at $120/hr for Alex due in 14 days` → Generate → Create draft → Review & send (approval gate) | “Hosted AI turns plain language into an editable invoice: 3 × $120, due in 14 days. Nothing sends without my approval. Without owner sandbox credentials this is a labelled local simulation, not a PayPal send.” |
| 140–155s | 390px mobile: Home, Invoices, AI, More sheet | “On mobile: Home, Invoices, AI, and More for clients, activity and settings — all keyboard accessible.” |
| 155–165s | Activity page provenance labels; Settings status | “Every record says where it came from: draft, self-reported, or entered by you. Real AI is verified; PayPal sandbox status is shown honestly.” |

## Only after verifying sandbox delivery
Replace the 115–140s segment only after operator unlock and a real sandbox create → approved send → GET status succeeds. Show the PayPal invoice ID and the exact returned status, use a fictional sandbox buyer you control, never a real email. Do not claim paid unless sandbox retrieval confirms it.

## Recording checklist
- Reset demo data in Settings first so the promised/overdue examples appear.
- Cuts may shorten waits but must not fabricate results.
- Recheck public playback signed out; paste the real URL into Devpost.