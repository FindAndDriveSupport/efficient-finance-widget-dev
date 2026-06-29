# E-fficient Finance Widget

A 3-step vehicle-finance pre-qualification + application wizard, built with TanStack Start + React 19.

## Embedding the Widget

### Option 1 — iFrame

```html
<iframe
  src="https://widget.yoursite.co.za?dealer=findndrive&make=Toyota&model=Corolla&mm=12345678"
  width="100%" height="750" frameborder="0" style="border-radius:16px;"
></iframe>
```

### Option 2 — Script tag (recommended)

```html
<!-- 1. Load the script once in <head> -->
<script src="https://widget.yoursite.co.za/embed.js"></script>

<!-- 2. Place the widget element anywhere -->
<efficient-finance-widget
  dealer="findndrive"
  make="Toyota"
  model="Corolla"
  mm="12345678"
></efficient-finance-widget>
```

### Supported query/attribute parameters

| Param   | Description                        | Example     |
|---------|------------------------------------|-------------|
| dealer  | Dealer key (controls theme)        | findndrive  |
| make    | Vehicle make                       | Toyota      |
| model   | Vehicle model                      | Corolla     |
| mm      | Mead & McGrouther 8-digit code     | 12345678    |
| branch  | Override branch code (optional)    | FND001      |

## Environment

Copy `.env.example` to `.env` and set:

- `VITE_WORKER_URL` — base URL of the backend Worker (no trailing slash). When unset, the widget uses deterministic mock responses so the preview keeps working.
- `VITE_MIXPANEL_TOKEN` — optional; when set, page-view and step events are tracked.

All API calls send the `X-Dealer-Key` header derived from the `dealer` query parameter (see `src/lib/worker.ts`).
