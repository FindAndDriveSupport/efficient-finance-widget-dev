## Goal

Evolve the existing 3-step wizard into the architecture described in `LOVABLE_SPEC.md`, wire in Mixpanel tracking, align Step 3's fields with the Edith CreatePolicy mapping, and surface Edith-style error messages — without throwing away the current UI, validation, and styling that already work.

This is delivered in 4 phases. I will execute them in order; you can stop me after any phase.

---

## Phase 1 — Foundations (contexts, query params, worker client, analytics)

Files added:
- `src/contexts/EmbedContext.tsx` — parses `dealer`, `make`, `model`, `mm`, `branchCode` from `window.location.search` once on mount.
- `src/contexts/DealerContext.tsx` — fetches dealer theme/logo/features from the Worker (mocked when `VITE_WORKER_URL` is absent so the preview keeps working), applies CSS variables to `:root` for `--primary` etc.
- `src/contexts/WizardContext.tsx` — wraps existing `WizardData` state + phase machine currently inside `Wizard.tsx`, exposes `data`, `setData`, `phase`, `goTo`, `back`.
- `src/lib/worker.ts` — typed `fetchPreQual`, `fetchPrediction`, `submitApplication` wrappers around `VITE_WORKER_URL`, with safe mock fallbacks for local preview.
- `src/lib/mixpanel.ts` — TS port of the uploaded `mixpanel-tracking.js` (`usePageTimer`, `trackHomePageLoad`, `trackStep1Continue`, `trackStep2Submit`, `trackStep3SubmitApplication`).

Files edited:
- `src/routes/__root.tsx` — wrap with `EmbedProvider` → `DealerProvider` → `WizardProvider`. Inject Mixpanel script tag conditionally on `VITE_MIXPANEL_TOKEN`.
- `src/components/wizard/Wizard.tsx` — read state from `WizardContext` instead of local `useState`; fire `trackHomePageLoad` on mount; call `trackStep1Continue` / `trackStep2Submit` on transitions.
- `src/components/wizard/Step1.tsx`, `Step2.tsx`, `Step3.tsx` — call `usePageTimer` at the top.

Kept as-is: `QualificationBanner`, `StepHeader`, `LoadingPage`, `ResponsePage`, `HelpButton`, validation utilities, color tokens.

---

## Phase 2 — Step 3 field alignment with Edith CreatePolicy mapping

Files edited:
- `src/components/wizard/types.ts` — extend `WizardData` with the Edith-mapped fields grouped to match the existing accordion sections:
  - Personal: title, initials, dateOfBirth (derived from SA ID where possible), gender, race, language, dependants, maritalStatus, marriageType, nationality, countryOfBirth.
  - Contact: homeTel, workTel, email, preferredCommMethod.
  - Address: residentialType, streetAddress, suburb, city, province, postalCode, yearsAtAddress, monthsAtAddress.
  - Next of kin: firstName, lastName, relationship, contactNumber.
  - Employment: status, employerName, industry, occupation, level, employmentDate, employerStreet, suburb, city, province, postalCode, employerTel, salaryDay.
  - Income confirmation: confirmedGross, confirmedNet.
- `src/components/wizard/Step3.tsx` — add the missing fields inside the existing accordion sections, with Zod-validated `react-hook-form` per section (kept lightweight — accordion + sections stays the same UX).
- `src/components/wizard/dropdowns.ts` — enum lists for title, gender, race, language, marital status, province, industry, employment status, etc., matching the Edith allowed values.
- Vehicle/dealership block prefills from `EmbedContext` (`make`, `model`, `mm`).

---

## Phase 3 — Edith error handling

Files added:
- `src/lib/edithErrors.ts` — TS port of the uploaded `edithErrors.js` (`STATUS_CODES`, `SYSTEM_MESSAGES`, `FIELD_ERRORS`, `parseEdithErrors`, `getErrorMessage`).
- `src/components/wizard/EdithErrorBanner.tsx` — renders system-level errors as a destructive alert with title / message / action.
- `src/components/wizard/FieldErrorHint.tsx` — small inline error renderer used under any Step 3 field whose `FieldName` comes back in an Edith response.

Files edited:
- `src/components/wizard/Step3.tsx` — on submit, call `submitApplication` from `lib/worker.ts`; on Edith error response, map errors → field-level hints + system banner; block resubmit when fatal (300) errors are present until fixed.

---

## Phase 4 — Polish & docs

- `README` snippet on embed URL params + `VITE_WORKER_URL` / `VITE_MIXPANEL_TOKEN`.
- Smoke check: dev server boots, `/`, `/?dealer=findndrive&make=Toyota&model=Corolla` both render, Step 1→2→loading→response→Step 3 flow still works.

---

## Technical notes

- React Hook Form + Zod will be added only where new validation is needed (Step 3). Step 1/2 keep their current controlled inputs and mobile/thousands validation to avoid regressions.
- TanStack Query is already installed; worker calls in `lib/worker.ts` will be wrapped with `useMutation` at call sites in Step 1 (`/prequal`), Step 2 (`/prediction`), Step 3 (`/application`).
- Framer Motion is **not** added — the current CSS transitions cover the "subtle" requirement and skipping it avoids a new dep.
- Mock fallback: when `import.meta.env.VITE_WORKER_URL` is missing, worker functions return the same simulated tier/loading behaviour the wizard does today, so the Lovable preview keeps working without a backend.
- No design changes: existing purple gradient, QualifyCard, StepHeader, HelpButton, validation messages all stay.

After you approve I'll start with Phase 1 and report back before moving to Phase 2.