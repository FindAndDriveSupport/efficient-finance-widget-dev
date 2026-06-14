/**
 * dealers.config.js
 *
 * ████████████████████████████████████████████████████████████████
 *  SINGLE SOURCE OF TRUTH — ALL DEALER SETTINGS LIVE HERE
 *  Add a dealer, change a theme, update branch codes — all in one place.
 * ████████████████████████████████████████████████████████████████
 *
 * Each dealer entry controls:
 *   - Edith branch code
 *   - Whitelisted embed domains
 *   - UI theme (colours, logo)
 *   - Feature flags
 *   - Finance Type
 */

export const DEALERS = {
  // ─────────────────────────────────────────────────────────────
  // EXAMPLE DEALER 1 — FindnDrive (default / fallback)
  // ─────────────────────────────────────────────────────────────
  'findndrive': {
    name: 'FindnDrive',
    branchCode: 'SRT001EM',                    // ← Edith BranchCode
    financeType: 'vehicle',
    allowedDomains: [
      'findndrive.co.za',
      'seritifinancedev.findndrive.co.za',
      'seritifinance.findndrive.co.za',
      'www.findndrive.co.za',
      'localhost',
      'findanddrivesupport-e-fficient-ui.still-fire-1c3d.workers.dev',
    ],
    theme: {
      primary: '#6C3FC5',
      primaryLight: '#8B5CF6',
      primaryDark: '#4C1D95',
      gradient: 'linear-gradient(135deg, #6C3FC5 0%, #C026D3 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
      logoUrl: '/logos/findndrive.svg',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,              // accepts ?make=&model=&mm= in embed URL
    },
  },

  // ─────────────────────────────────────────────────────────────
  // EXAMPLE DEALER 2 — Car Dealer XYZ
  // ─────────────────────────────────────────────────────────────
  'dealer-xyz': {
    name: 'Car Dealer XYZ',
    branchCode: 'XYZ002',
    financeType: 'vehicle',
    allowedDomains: [
      'dealerxyz.co.za',
      'www.dealerxyz.co.za',
    ],
    theme: {
      primary: '#E63946',
      primaryLight: '#FF6B6B',
      primaryDark: '#9B0000',
      gradient: 'linear-gradient(135deg, #E63946 0%, #FF6B6B 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '8px',
      logoUrl: '/logos/dealer-xyz.svg',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: false,
      vehicleQueryParams: true,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // ADD MORE DEALERS BELOW — copy a block, change the values
  // ─────────────────────────────────────────────────────────────
};

// ── Lookup helpers ────────────────────────────────────────────

/**
 * Get dealer config by branchCode query param or referring domain.
 * Priority: explicit ?dealer= param → referring domain match → null
 */
export function getDealerConfig(dealerKey, referringDomain) {
  // 1. Explicit key (from query param ?dealer=findndrive)
  if (dealerKey && DEALERS[dealerKey]) {
    return { key: dealerKey, ...DEALERS[dealerKey] };
  }

  // 2. Match by referring domain
  if (referringDomain) {
    const hostname = referringDomain.replace(/^https?:\/\//, '').split('/')[0];
    for (const [key, config] of Object.entries(DEALERS)) {
      if (config.allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        return { key, ...config };
      }
    }
  }

  // 3. Fallback to first dealer (or null — your choice)
  const [firstKey, firstConfig] = Object.entries(DEALERS)[0];
  return { key: firstKey, ...firstConfig };
}

/**
 * Check whether a given origin is whitelisted for any dealer.
 * Used by the CORS / embed middleware.
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;
  const hostname = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

  for (const config of Object.values(DEALERS)) {
    if (config.allowedDomains.includes(hostname)) return true;
    if (config.allowedDomains.some(d => hostname.endsWith(`.${d}`))) return true;
  }
  return false;
}