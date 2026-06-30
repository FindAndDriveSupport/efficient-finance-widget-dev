# E-fficient Finance Widget — Lovable Frontend Spec
**Version 1.0 | For Lovable AI code generation**

---

## Overview

Build a React app (Vite + TypeScript) that is a 3-step finance pre-qualification wizard. It must be:
- **Embeddable** as a widget (iframe or web component) on dealer websites
- **Theme-aware** — loads dealer colours/logo from the backend on mount
- **Query-param aware** — accepts vehicle and dealer context in the URL
- **Mobile-first** — optimised for iOS/Android WebView and small screens

---

## Tech Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** for styling (CSS variables for theming)
- **React Hook Form** for all form state
- **Zod** for schema validation
- **React Query (TanStack)** for API calls
- **Framer Motion** for transitions (subtle, not flashy)
- **Mixpanel** for analytics (loaded once at app root)

---

## Environment Variables

```
VITE_WORKER_URL=https://api.yourwidgetdomain.co.za
```

All API calls go through the Cloudflare Worker at `VITE_WORKER_URL`. Never call Seriti or Edith directly from the frontend.

---

## Query Parameters (Embed URL)

The React app must read these on mount:

| Param         | Required | Description                              |
|---------------|----------|------------------------------------------|
| `dealer`      | No       | Dealer key (e.g. `findndrive`)           |
| `make`        | No       | Vehicle make (e.g. `Toyota`)             |
| `model`       | No       | Vehicle model (e.g. `Corolla`)           |
| `mm`          | No       | Mead & McGrouther vehicle code           |
| `branchCode`  | No       | Override dealer branch code              |

Store parsed params in a top-level context (`EmbedContext`) so all steps can access them.

---

## App Architecture

```
src/
├── contexts/
│   ├── DealerContext.tsx    ← theme, branchCode, features
│   ├── WizardContext.tsx    ← shared state across all 3 steps
│   └── EmbedContext.tsx     ← parsed query params
├── components/
│   ├── layout/
│   │   ├── WizardShell.tsx  ← step indicator, back button, progress bar
│   │   └── QualifyCard.tsx  ← purple gradient card (YOU MAY QUALIFY FOR)
│   ├── steps/
│   │   ├── Step1.tsx        ← Personal details + pre-qual call
│   │   ├── Step2.tsx        ← Income & identity + prediction call
│   │   ├── LoadingScreen.tsx← Experian/loading animation between steps
│   │   ├── ResultPage.tsx   ← Prediction result + consent
│   │   └── Step3.tsx        ← Full application form (pre-filled)
│   └── ui/                  ← Shared: Input, Button, Toggle, Modal, etc.
├── hooks/
│   ├── useDealer.ts
│   ├── useMixpanel.ts
│   └── useWizard.ts
├── lib/
│   ├── api.ts               ← All fetch calls to Worker
│   ├── validation.ts        ← Zod schemas
│   └── formatters.ts        ← Currency formatting (R15 000, not R15000)
├── mixpanel-tracking.ts     ← Copy of mixpanel-tracking.js provided
└── App.tsx
```

---

## Theming System

On app mount, call `GET /api/dealer/config` (with `X-Dealer-Key` header if `?dealer=` param present). This returns:

```json
{
  "key": "findndrive",
  "name": "FindnDrive",
  "theme": {
    "primary": "#6C3FC5",
    "primaryLight": "#8B5CF6",
    "primaryDark": "#4C1D95",
    "gradient": "linear-gradient(135deg, #6C3FC5 0%, #C026D3 100%)",
    "fontFamily": "'Inter', sans-serif",
    "borderRadius": "12px",
    "logoUrl": "/logos/findndrive.svg"
  },
  "features": {
    "showDeposit": true,
    "showCurrentFinance": true,
    "vehicleQueryParams": true
  }
}
```

Apply theme to CSS variables on `<html>`:
```css
--color-primary: #6C3FC5;
--color-primary-light: #8B5CF6;
--color-gradient: linear-gradient(135deg, #6C3FC5 0%, #C026D3 100%);
--border-radius: 12px;
```

All buttons, cards, and highlights must use `var(--color-primary)`.

---

## Step 1 — "Let's get to know you"

### UI
- Heading: **"Let's get to know you"**
- Subheading: "A few quick details to estimate what you qualify for."
- QualifyCard at top showing R0/pm (Monthly) or R0 total (toggle) — both start at R0
- White card with form fields
- CTA: Purple full-width button **"Continue"**

### Form Fields (all required unless noted)

| Field | Label | Validation |
|-------|-------|-----------|
| `firstName` | Name | Required |
| `lastName` | Surname | Required |
| `netIncome` | Net Salary / Take-home Salary (monthly, max R150 000) | Number, R prefix, max 150000 |
| `mobileNumber` | Mobile number | SA mobile, 10 digits, valid prefix, no landlines, no fake |
| `hasDeposit` | I have a deposit | Optional checkbox/toggle |
| `hasExistingFinance` | I currently have finance | Optional checkbox/toggle |

**Net income field:** Display "R" before the number input. Format value with space thousands (e.g. R15 000).

**Mobile validation rules:**
- Must be 10 digits starting with 0
- Valid prefixes: 060–069, 071–079, 081–087
- Reject landlines (starting with 01x)
- Reject obviously fake (all same digit, 0000000000)
- Reject +27 format (show error: use 0XXXXXXXXX format)

### On "Continue" click
1. Validate form
2. Call `POST /api/financing/pre-qualification` with form data + vehicle params from URL
3. Store `{ totalAmount, monthlyAmount, applicantId }` in WizardContext
4. Update QualifyCard with returned amounts
5. **Navigate to Step 2** (amounts remain visible and updated)
6. Track: `trackStep1Continue()`

### Note
The QualifyCard amounts (R/pm and Total) only appear as dynamic values on **Step 2**, not Step 1. On Step 1 both show R0. The spec requires these to show on Step 2 after the pre-qual returns.

---

## Step 2 — "Income & identity"

### UI
- Back button (← Step 2 of 3)
- Progress bar: 66% filled
- Heading: **"Income & identity"**
- Subheading: "A bit more to refine your estimate."
- QualifyCard now shows **live values** from Step 1 API response (R15 000/pm toggle Monthly/Total)
- White card with form fields
- CTA: **"Submit"** (was "Run my pre-qualification")

### Form Fields

| Field | Label | Validation |
|-------|-------|-----------|
| `grossIncome` | Gross Salary (monthly, max R250 000) | Number, R prefix, required |
| `hasNoSAID` | I do not have a South African ID | Checkbox — hides ID field when checked |
| `idNumber` | South African ID number | Required if not hasNoSAID; 13-digit SA ID full validation |
| `livingExpenses` | Household expenses | Number, R prefix, required |

**SA ID Validation (client-side, mirrors backend):**
1. Length = 13 digits
2. Valid date in first 6 digits (YYMMDD)
3. Not all same digit (obviously fake check)
4. Luhn checksum validation

**Gross income:** Display "R" prefix. Label must say **"Gross Salary"** (not "Gross income").

**Household expenses:** Was "Total monthly living expenses". Include a help/info icon (ⓘ) that opens a modal. Modal content:
> "Household expenses include rent or bond payments, groceries, utilities, transport, school fees, insurance, and any other monthly costs for your household."

**Help modal mobile fix:** Ensure the modal header ("Need a hand" + close ✕ icon) is not cut off on small screens. Use `position: fixed`, `max-height: 90vh`, `overflow-y: auto`, and padding-top safe area.

### On "Submit" click
1. Validate all fields
2. Show LoadingScreen
3. Call `POST /api/financing/prediction`
4. Navigate to ResultPage
5. Track: `trackStep2Submit()`

---

## Loading Screen

Show between Step 2 submit and the Result page.

- Full-screen overlay (white background)
- Animated logo (dealer logo from theme, pulsing or spinning)
- Text: "Checking your profile…" then "Almost there…" (cycle slowly)
- **Experian logo**: Use the Experian logo asset provided separately (ask client). Show text "Powered by Experian" if logo not yet available.
- **Intentionally slow**: Minimum 3.5 seconds regardless of API response time. Use `Promise.all([apiCall, delay(3500)])`.

---

## Result Page — Prediction

### Prediction mapping (from API response `prediction.label`):

| API `prediction.label` | Shown as | Headline | Body text |
|------------------------|----------|----------|-----------|
| `In progress` | Orange card | "Let's move forward with your application!" | "We'll contact you to guide you through the next steps and explore the best options together." |
| `Good news` | Green card | "You have a good chance of qualifying!" | "Your profile looks promising. Complete your application and we'll be in touch shortly." |
| `Great news` | Dark green card | "You're likely to qualify!" | "Your profile looks great. Submit your application and we'll help you get into your next car." |

Card colour by result:
- In progress: `#F59E0B` (amber/orange)
- Good news: `#10B981` (emerald)
- Great news: `#059669` (dark emerald)

### Below the result card:

**TIP section** (white card with lightbulb icon):
- Label: "TIP"
- Content: API `reason` field

**Affordability section** (white card):
- "Estimated approval amount": API `estimatedApprovalAmount` (formatted as R XXX XXX)
- "Monthly instalment": API `monthlyInstalment` (was "estimatedFinanceSpend")

**Consent & Declarations** (white card):
- Heading: "Consent & Declarations"
- Subheading: "Please read the consents and declarations below and select each checkbox if you give consent or agree."
- Checkboxes (all must be ticked to proceed):
  - "I give consent to my application being sent to one or more financial institutions."
  - "I give consent to the credit bureau to process my credit information including income, employment, personal data for prescribed business as per related Acts and that such outcome may be shared with the 3rd Party."
  - "I am currently NOT liable as a guarantor."
- Purple full-width button: **"Submit Application"**

### On "Submit Application" click:
1. Verify all 3 consents are ticked (show validation error if not)
2. Call `GET /api/financing/applicant?applicantId={applicantId}`
3. Store applicant data in WizardContext
4. Navigate to Step 3 (pre-filled)
5. Track: `trackStep3SubmitApplication()`

---

## Step 3 — Full Application Form

This is the final form. All fields that match the applicant data from `GET /api/Financing/GetApplicantById` must be **pre-filled**.

Group fields into collapsible sections:

### Section 1: Personal Details
- Title (dropdown: Mr, Mrs, Miss, Ms, Dr, Prof, Adv, Hon, Rev)
- First name (pre-filled)
- Last name (pre-filled, required)
- ID number (pre-filled)
- Gender (pre-filled, dropdown: Male, Female)
- Date of birth (pre-filled, dd-MMM-yyyy format)
- Email address (pre-filled)
- Mobile number (pre-filled)
- Education level (dropdown)
- Marital status (dropdown)

### Section 2: Residential Address
- Address line 1
- Suburb
- City
- Province (dropdown)
- Post code
- Residential status (dropdown: Renting, Own, Living with family, etc.)

### Section 3: Next of Kin
- Relationship
- First name
- Last name
- Mobile number

### Section 4: Employment
- Employment type (dropdown: Permanent, Contract, Self-employed, etc.)
- Employer name
- Industry (dropdown)
- Occupation (dropdown)
- Occupation level (dropdown)
- Employment start date
- Work telephone (area code + number in separate fields)
- Salary day (1–31)

### Section 5: Financial Details
- Basic salary (R prefix)
- Net salary (R prefix)
- Finance term (months dropdown: 12, 24, 36, 48, 60, 72)
- Deposit amount (R prefix, if hasDeposit from Step 1)
- Payment day (1–28)

### Section 6: Marketing Consents
- Telesales marketing consent (checkbox)
- Email marketing consent (checkbox)
- SMS marketing consent (checkbox)
- IDX consent (checkbox)
- IVX consent (checkbox)

### Submit Button
- Full-width purple: **"Submit Application"**
- On click:
  1. Validate required fields (LastName minimum)
  2. Call `POST /api/policy/create` with all form data
  3. On success: show success screen with policy number
  4. On error: display user-facing error from edithErrors mapping

### Success Screen
- Tick icon (animated)
- "Application submitted!"
- "Your reference number: [policyNumber]"
- "A member of our finance team will be in touch shortly."
- Dealer logo

### Error Handling (from edithErrors)
Display errors as inline form field errors (for field-level) or a full-width red alert banner (for system errors). Use the `title`, `message`, and `action` fields from the error response.

---

## Mixpanel Integration

Install: `npm install mixpanel-browser`

Initialise in `App.tsx` on mount using the token from the dealer config (single token for all dealers; referring domain differentiates):

```typescript
import mixpanel from 'mixpanel-browser';

// In App.tsx useEffect after dealer config loads:
mixpanel.init(dealerConfig.mixpanelToken, {
  track_pageview: false,
  persistence: 'localStorage',
});

// Set super properties for dealer tracking
mixpanel.register({
  dealer_key: dealerConfig.key,
  dealer_name: dealerConfig.name,
  referring_domain: document.referrer,
  embed_url: window.location.href,
  // Vehicle details if present
  ...(embedParams.make  ? { vehicle_make: embedParams.make }  : {}),
  ...(embedParams.model ? { vehicle_model: embedParams.model } : {}),
});
```

Use the tracking functions from `mixpanel-tracking.ts` (copy the provided file):
- `trackHomePageLoad()` — on Step 1 mount
- `trackStep1Continue()` — on Step 1 continue click
- `trackStep2Submit()` — on Step 2 submit click
- `trackStep3SubmitApplication()` — on Step 3 submit click
- `usePageTimer(stepName)` — in each step component

---

## Widget / Embed Mode

The app must support two embed modes:

### Mode 1: iframe
Any page can embed the widget:
```html
<iframe
  src="https://widget.yoursite.co.za?dealer=findndrive&make=Toyota&model=Corolla"
  width="100%"
  height="700"
  frameborder="0"
></iframe>
```
The Worker handles CORS. The iframe `src` includes query params.

### Mode 2: Web Component (stretch goal)
```html
<script src="https://widget.yoursite.co.za/embed.js"></script>
<efficient-finance-widget dealer="findndrive" make="Toyota" model="Corolla"></efficient-finance-widget>
```
Build a `public/embed.js` that:
1. Reads attributes from the custom element
2. Creates an iframe with those values as query params
3. Injects it into the DOM

```javascript
// public/embed.js
class EfficientWidget extends HTMLElement {
  connectedCallback() {
    const dealer = this.getAttribute('dealer') || '';
    const make   = this.getAttribute('make') || '';
    const model  = this.getAttribute('model') || '';
    const mm     = this.getAttribute('mm') || '';

    const params = new URLSearchParams({ dealer, make, model, mm });
    const iframe = document.createElement('iframe');
    iframe.src = `https://widget.yoursite.co.za?${params}`;
    iframe.style.cssText = 'width:100%;height:700px;border:none;border-radius:16px;';
    iframe.allow = 'fullscreen';
    this.appendChild(iframe);
  }
}
customElements.define('efficient-finance-widget', EfficientWidget);
```

---

## API Client (`src/lib/api.ts`)

```typescript
const WORKER = import.meta.env.VITE_WORKER_URL;

function headers(dealerKey?: string) {
  return {
    'Content-Type': 'application/json',
    ...(dealerKey ? { 'X-Dealer-Key': dealerKey } : {}),
  };
}

export const api = {
  getDealerConfig: (dealerKey: string) =>
    fetch(`${WORKER}/api/dealer/config`, { headers: headers(dealerKey) }).then(r => r.json()),

  preQualify: (body: PreQualBody, dealerKey: string) =>
    fetch(`${WORKER}/api/financing/pre-qualification`, {
      method: 'POST', headers: headers(dealerKey), body: JSON.stringify(body),
    }).then(r => r.json()),

  predict: (body: PredictBody, dealerKey: string) =>
    fetch(`${WORKER}/api/financing/prediction`, {
      method: 'POST', headers: headers(dealerKey), body: JSON.stringify(body),
    }).then(r => r.json()),

  getApplicant: (applicantId: string, dealerKey: string) =>
    fetch(`${WORKER}/api/financing/applicant?applicantId=${applicantId}`, {
      headers: headers(dealerKey),
    }).then(r => r.json()),

  createPolicy: (body: PolicyBody, dealerKey: string) =>
    fetch(`${WORKER}/api/policy/create`, {
      method: 'POST', headers: headers(dealerKey), body: JSON.stringify(body),
    }).then(r => r.json()),
};
```

---

## Currency Formatting

All monetary values must be formatted as South African Rands:
- `R15 000` (not R15,000 and not R15000)
- `R1 500 000` for large amounts
- "R" prefix before input fields (shown as static prefix, not in the value)
- API values are numbers; format on display only

```typescript
// src/lib/formatters.ts
export function formatRand(amount: number): string {
  return 'R' + Math.round(amount).toLocaleString('en-ZA').replace(/,/g, ' ');
}
```

---

## Responsive / Mobile Requirements

- Min width: 320px (small Android)
- Default width in iframe: 100% (fills container)
- All touch targets: min 44px height
- Help modals: fixed, safe-area aware, scrollable
- Form inputs: font-size ≥ 16px (prevents iOS zoom)
- Progress bar visible on all screen sizes
- QualifyCard must be visible without scrolling on mobile (compact version if needed)

---

## Error States

Each API call must handle:
- Network error → "Unable to connect. Please check your connection and try again."
- Worker 400 → show inline field validation errors
- Worker 422 → show edith error message (`title` + `action`)
- Worker 500 → "Something went wrong. Please try again or contact the dealership."

---

## Accessibility

- All inputs have `<label>` with `htmlFor`
- Error messages linked via `aria-describedby`
- Focus management: when navigating between steps, focus moves to step heading
- Colour contrast: all text on coloured backgrounds must pass AA
- Disable "Continue"/"Submit" button while loading (show spinner inside button)

---

## Files to Copy from Provided Assets

1. **`src/mixpanel-tracking.ts`** — Copy `mixpanel-tracking.js` verbatim (rename .ts, add types)
2. **`src/lib/edithErrors.ts`** — Copy `edithErrors.js` for frontend error display
3. **Experian logo** — Request from client; place at `public/logos/experian.svg`
4. **Dealer logos** — `public/logos/{dealer-key}.svg` per dealer

---

## GitHub Repository Structure

```
/
├── frontend/          ← React app (this spec)
│   ├── src/
│   ├── public/
│   │   ├── logos/
│   │   └── embed.js
│   ├── .env.example
│   └── package.json
├── workers/           ← Cloudflare Worker (already built)
│   └── worker.js
├── src/               ← Worker source
├── wrangler.toml
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

---

## Definition of Done

- [ ] 3-step wizard works end-to-end in browser
- [ ] Theme loads from Worker on mount; changing dealer key changes colours
- [ ] All Zod validations match backend validation rules
- [ ] SA ID validation (length, date, fake check, Luhn) works client-side
- [ ] Mobile number validation rejects landlines and fake numbers
- [ ] Mixpanel fires on each step action
- [ ] Page timer events fire on step unmount
- [ ] App works embedded in an iframe with query params
- [ ] embed.js web component works independently
- [ ] Loading screen shows minimum 3.5s
- [ ] Currency formatted as R15 000 (not R15,000)
- [ ] Help modal not cut off on mobile (tested iPhone SE)
- [ ] All form fields have proper labels and error states
- [ ] Success screen shows policy reference number
- [ ] Error states from edithErrors show user-facing messages
