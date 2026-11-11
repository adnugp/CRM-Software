# TODO

## Go live
- [ ] Follow `docs/go-live.md`: rehearse with a copy of the live data, run the checks,
      merge, move the live data (`npm run migrate`) and deploy straight after. The live
      database is open to everyone until then.

## After go-live
- [ ] Two Hosting sites / a custom domain: the main domain for `/signup` (and later a landing
      page), an `app.` domain for the app. Set `VITE_APP_URL` so invite links point there.

## Product (later sub-projects)
- [ ] Card payment with Stripe (Cloud Functions, Blaze plan): replace the demo
      `savePaymentMethod` in `src/services/billing.ts`, charge when the trial ends,
      send invite and sign-up emails, and verify sign-up email addresses.

## Known gaps
- [ ] The project "Executive Briefing" PDF (`ProjectManagement.tsx`) prints a fixed
      risk paragraph ("financial leakage ≈ 1.8%", "self-fundable") that is not calculated
      from the project. Replace it with real figures or remove it before selling.
- [ ] Removing a user deletes their profile but not their Firebase Auth login (needs a Cloud
      Function with the Admin SDK). They can still sign in but see no data.
- [ ] Replacing a company logo leaves the old file in Storage.
- [ ] "Email alert" settings are stored only in the browser (localStorage) and nothing sends emails.
- [ ] Plan names, prices and `SALES_EMAIL` in `src/config/plans.ts` are placeholders.
- [ ] Turn on TypeScript `strict` mode gradually. Form data types are loose because it's off.
