# E-fficient Finance Widget — Backend

Cloudflare Worker that securely proxies all API calls between the React frontend and:
- **Seriti API** (`seritiapi.findndrive.co.za`) — pre-qualification & prediction
- **Edith Webservice** (`seritisolutions.co.za`) — policy creation

All secrets live in Cloudflare Worker environment variables. The frontend never touches an API key.

---

## Quick Start

### 1. Install Wrangler
```bash
npm install
npm install -g wrangler
wrangler login
```

### 2. Create KV namespace (token cache)
```bash
wrangler kv:namespace create SERITI_CACHE
# Copy the ID printed, paste into wrangler.toml → kv_namespaces[0].id
```

### 3. Set secrets
```bash
wrangler secret put SERITI_API_KEY      # Seriti API key
wrangler secret put SERITI_API_SECRET   # Seriti API secret
wrangler secret put EDITH_COMPANY_CODE  # Edith CompanyCode (from Agatha Design)
wrangler secret put EDITH_COMPANY_PASS  # Edith CompanyPassword (from Agatha Design)
```

### 4. Add your dealers
Edit `src/dealers/dealers.config.js`:
- Add branch codes, allowed domains, theme colours
- This is the **only file you need to touch** to onboard a new dealer

### 5. Run locally
```bash
npm run dev
# Worker available at http://localhost:8787
```

### 6. Deploy
```bash
npm run deploy:prod
```

---

## Dealer Management

All dealer configuration lives in one file: `src/dealers/dealers.config.js`

To add a new dealer:
1. Copy an existing dealer block
2. Set `branchCode` (from Agatha Design / Edith onboarding)
3. Add `allowedDomains` (their website domains)
4. Customise `theme` (primary colour, logo URL)
5. Deploy

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dealer/config` | Returns theme + features (safe, no secrets) |
| POST | `/api/financing/pre-qualification` | Step 1: Pre-qual |
| POST | `/api/financing/prediction` | Step 2: Prediction |
| GET | `/api/financing/applicant?applicantId=` | Post-consent applicant data |
| POST | `/api/policy/create` | Step 3: Create Edith policy |

---

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`:
1. Lint + test
2. Deploy Worker to Cloudflare
3. Build + deploy React app to Cloudflare Pages

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_WORKER_URL`

---

## Security Notes

- API keys are **never** in code or git — Cloudflare Worker secrets only
- Domain whitelisting enforced on every request via `isOriginAllowed()`
- Edith credentials (CompanyCode/Password) injected server-side; frontend never sees them
- Bearer token refreshed automatically via KV cache (never expires client-side)
- Structured error logging to Cloudflare — `wrangler tail` for live logs
