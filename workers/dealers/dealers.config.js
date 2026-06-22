/**
 * dealers.config.js
 *
 * ████████████████████████████████████████████████████████████████
 *  SINGLE SOURCE OF TRUTH — ALL DEALER SETTINGS LIVE HERE
 *  Add a dealer, change a theme, update branch codes — all in one place.
 * ████████████████████████████████████████████████████████████████
 */

export const DEALERS = {
  // ─────────────────────────────────────────────────────────────
  // FindnDrive (default / fallback)
  // ─────────────────────────────────────────────────────────────
  'findndrive': {
    name: 'FindnDrive',
    branchCode: 'SRT001EM',
    financeType: 'vehicle',
    edithEnv: 'dev',
    allowedDomains: [
      'findndrive.co.za',
      'www.findndrive.co.za',
      'seritifinancedev.findndrive.co.za',
      'seritifinance.findndrive.co.za',
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
      vehicleQueryParams: true,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Keitzman Finance
  // ─────────────────────────────────────────────────────────────
  'keitzman-finance': {
    name: 'Keitzman Finance',
    branchCode: 'KAEF001',
    financeType: 'vehicle',
    edithEnv: 'prod',
    allowedDomains: [
      'keitzmanfinance.co.za',
      'keitzman-finance.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#c0392b',
      gradient: 'linear-gradient(135deg, #c0392b 0%, #c0392b 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Yonda Bike
  // ─────────────────────────────────────────────────────────────
  'yonda-bike': {
    name: 'Yonda Bike',
    branchCode: 'YOND001',
    financeType: 'bike',
    edithEnv: 'prod',
    allowedDomains: [
      'yonda.co.za',
      'yonda-bike.seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#0154fc',
      gradient: 'linear-gradient(135deg, #0154fc 0%, #0154fc 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // ADD MORE DEALERS BELOW — copy a block, change the values
  // ─────────────────────────────────────────────────────────────
};

// ── Lookup helpers ────────────────────────────────────────────

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

  // 3. Fallback to first dealer
  const [firstKey, firstConfig] = Object.entries(DEALERS)[0];
  return { key: firstKey, ...firstConfig };
}

export function isOriginAllowed(origin) {
  if (!origin) return false;
  const hostname = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

  for (const config of Object.values(DEALERS)) {
    if (config.allowedDomains.includes(hostname)) return true;
    if (config.allowedDomains.some(d => hostname.endsWith(`.${d}`))) return true;
  }
  return false;
}
