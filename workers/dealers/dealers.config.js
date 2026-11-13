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
 *   - Finance type
 *   - Edith environment (dev | prod)
 *   - Contact email for failure notifications
 *   - Billing type (transaction | fixed)
 *   - Branches (optional — for a single dealer with multiple Edith branch codes)
 *   - Group key (optional — for MULTIPLE, otherwise-independent dealer entries
 *     that belong to the same ownership group, e.g. a "multiple websites,
 *     multiple branches" onboarding setup). Give every entry in the same
 *     group the identical groupKey string. Used by billing-worker to roll
 *     up group members into one invoice line, and by the analytics
 *     dashboard to aggregate metrics across the group.
 *   - dealershipID (optional — Seriti's carFinanceDealershipBranchId GUID.
 *     Sourced from Seriti's dealership-branch export, matched here by
 *     branchCode. Consumed by preQual.js: if present, it's included as
 *     `dealershipID` in the Seriti pre-qualification payload.)
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
    contactEmail: 'support@findndrive.co.za',
    billingType: 'transaction',
    groupKey: null,
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
    contactEmail: 'yvette@keitzmanfinance.co.za',
    billingType: 'fixed',
    groupKey: null,
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
    contactEmail: 'marketing@yonda.co.za',
    billingType: 'fixed',
    groupKey: null,
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
  // North Western Motors
  // ─────────────────────────────────────────────────────────────
  'north-western-motors': {
    name: 'North Western Motors',
    branchCode: 'NWMC001',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'denise@northwestern.co.za',
    billingType: 'transaction',
    groupKey: null,
    allowedDomains: [
      'northwesternmotors.co.za',
      'north-western-motors.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#0a1361',
      gradient: 'linear-gradient(135deg, #0a1361 0%, #0a1361 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },


  'byd-durban': {
    name: 'BYD Durban',
    branchCode: 'ALPI041',
    dealershipID: 'bfc0d451-669b-4d64-8032-830a3eb7e5d8',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'RIAANM@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-durban.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  'byd-hillcrest': {
    name: 'BYD Hillcrest',
    branchCode: 'ALPI042',
    dealershipID: '2d7ef322-8808-405f-af5b-ccf9c70fe289',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'MICHELEV@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-hillcrest.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  'byd-pietermaritzburg': {
    name: 'BYD Pietermaritzburg',
    branchCode: 'ALPI043',
    dealershipID: '8275af4b-a4d2-4c4c-86a8-ec628e9e1d1a',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'MICHELEV@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-pietermaritzburg.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  'gwm-hillcrest': {
    name: 'GWM Hillcrest',
    branchCode: 'ALPI024',
    dealershipID: '23453d6f-0487-4109-a16c-10111dfb230f',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'ANNELINEB@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.gwmhillcrest.co.za/',
      'gwm-hillcrest.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
    },
  },

  'omoda-jaecoo-pinetown': {
    name: 'Omoda Jaecoo Pinetown',
    branchCode: 'ALPI029',
    dealershipID: 'b38e3393-7da9-4a31-85c1-4e14973b15ac',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'TENEILC@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.omodajaecoopinetown.co.za/',
      'omoda-jaecoo-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'baic-ballito': {
    name: 'BAIC Ballito',
    branchCode: 'ALPI035',
    dealershipID: '322da0c7-378b-40cc-a461-94b44d5e5828',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mariuss@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.baicballito.co.za/',
      'baic-ballito.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'baic-pinetown': {
    name: 'BAIC Pinetown',
    branchCode: 'ALPI026',
    dealershipID: '755069cf-f25a-42c3-ba29-53e9d671a64b',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'lauram@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.baicpinetown.co.za/',
      'baic-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'baic-umhlanga': {
    name: 'BAIC Umhlanga',
    branchCode: 'ALPI027',
    dealershipID: 'be300912-91ae-4473-b2fa-b4f8d98dcb63',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mackneyn@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.baic-umhlanga.co.za/',
      'baic-umhlanga.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'byd-ballito': {
    name: 'BYD Ballito',
    branchCode: 'ALPI034',
    dealershipID: '2512b85b-87c0-45bf-84b1-66391e21f2a4',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mariuss@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-ballito.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'byd-pinetown': {
    name: 'BYD Pinetown',
    branchCode: 'ALPI033',
    dealershipID: '7b9dd21f-4996-4592-844b-426127ace3c4',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kevinb@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'jetour-ballito': {
    name: 'JETOUR Ballito',
    branchCode: 'ALPI040',
    dealershipID: '86f319d6-f2a0-4797-b1fb-9dc3c968c4a7',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mariuss@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.jetouralpine.co.za/',
      'jetour-ballito.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'jetour-pinetown': {
    name: 'JETOUR Pinetown',
    branchCode: 'ALPI038',
    dealershipID: '7591422b-4352-496c-b84a-8354983c319b',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kenp@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.jetouralpine.co.za',
      'jetour-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'jetour-umhlanga': {
    name: 'JETOUR Umhlanga',
    branchCode: 'ALPI039',
    dealershipID: 'b724a94e-3fe5-4d52-899d-ec9916b29c55',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'darrenvn@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.jetouralpine.co.za',
      'jetour-umhlanga.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'renault-hillcrest': {
    name: 'Renault Hillcrest',
    branchCode: 'ALPI023',
    dealershipID: '6a37d438-deee-42da-befb-900e2cd739fb',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'joashd@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.renaulthillcrest.co.za/',
      'renault-hillcrest.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'all-cars-pinetown': {
    name: 'All Cars Pinetown',
    branchCode: 'ALPI030',
    dealershipID: '2ae9f33f-d06c-40d1-84e2-611912e6d773',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'justin@allcarspinetown.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://allcarspinetown.com/',
      'all-cars-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'alpine-cars': {
    name: 'Alpine Cars',
    branchCode: 'ALPI031',
    dealershipID: 'd7b37eea-bd71-45ba-8dbc-259d9251f74b',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mariuss@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.alpinecarsballito.co.za/',
      'alpine-cars.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'alpine-commercial': {
    name: 'Alpine Commercial',
    branchCode: 'ALPI018',
    dealershipID: 'a3f7320e-8d26-4bb9-b29f-ac04216c7aee',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kevinb@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://commercial.alpinemotors.co.za/',
      'alpine-commercial.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#001d51',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'audi-pinetown': {
    name: 'Audi Pinetown',
    branchCode: 'ALPI016',
    dealershipID: '36f69e59-38c9-4f1e-9b26-8847c39cac96',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'cuan@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.audicentrepinetown.co.za/',
      'audi-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'audi-umhlanga': {
    name: 'Audi Umhlanga',
    branchCode: 'ALPI020',
    dealershipID: '78a59284-7e78-49f3-a440-323666013e21',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'REDDYR@VWFS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.audi-umhlanga.co.za/',
      'audi-umhlanga.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'chery-durban': {
    name: 'Chery Durban',
    branchCode: 'ALPI037',
    dealershipID: '806be69f-7ec1-4965-9034-61cba47dede6',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'GEORGEN@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.cherydurban.co.za/',
      'chery-durban.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'chery-pinetown': {
    name: 'Chery Pinetown',
    branchCode: 'ALPI025',
    dealershipID: '639399ae-b73d-421c-9c23-c1bdd4b79e9b',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kevinb@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.cherypinetown.co.za/',
      'chery-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'icaur-pinetown': {
    name: 'Icaur Pinetown',
    branchCode: 'ALPI046',
    dealershipID: '11bf170a-10d6-44ba-86fd-b69f646c95c9',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kevinb@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.icaurpinetown.co.za/',
      'icaur-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'lepas-pinetown': {
    name: 'Lepas Pinetown',
    branchCode: 'ALPI044',
    dealershipID: '7a5d6b4c-5a41-4bee-bcf2-e70ad35dca69',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'kevinb@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.lepaspinetown.co.za/',
      'lepas-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'vw-hillcrest': {
    name: 'VW Hillcrest',
    branchCode: 'ALPI021',
    dealershipID: 'f574e15b-1f8e-481a-b656-b060d013f2ac',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'PAMMYG@ALPINEMOTORS.CO.ZA',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.hillcrestvw.co.za/',
      'vw-hillcrest.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#001d51',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'vw-pinetown': {
    name: 'VW Pinetown',
    branchCode: 'ALPI017',
    dealershipID: '36595225-2a8d-4ea8-b045-d4075a889692',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'lauram@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://volkswagen.alpinemotors.co.za/',
      'vw-pinetown.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#001d51',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'jetour-hillcrest': {
    name: 'Jetour Hillcrest',
    branchCode: 'ALPI045',
    dealershipID: 'e9013b2e-fdf8-4954-b4d1-0a20fce3fc9e',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'joashd@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://www.jetouralpine.co.za/',
      'jetour-hillcrest.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'byd-umhlanga': {
    name: 'BYD Umhlanga',
    branchCode: 'ALPI032',
    dealershipID: '7cd1d4dc-5975-462d-b29d-fbe84c05c4f3',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mackneyn@alpinemotors.co.za',
    billingType: 'fixed',
    groupKey: 'Alpine Motors',
    allowedDomains: [
      'https://bydkzn.co.za/',
      'byd-umhlanga.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#5d6e73',
      gradient: 'linear-gradient(135deg, #5d6e73 0%, #5d6e73 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'icaur-george': {
    name: 'ICAUR GEORGE',
    branchCode: 'VDWG005',
    dealershipID: '8e29b9cf-b40f-49ca-8070-0482c58a2db5',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'debbie@pmgrp.co.za',
    billingType: 'fixed',
    groupKey: 'Platina Motor Group',
    allowedDomains: [
      'https://www.icaurgardenroute.co.za/',
      'icaur-george.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f59e0b 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'icaur-rustenburg': {
    name: 'ICAUR RUSTENBURG',
    branchCode: 'VDWG004',
    dealershipID: '74644a43-3396-43a3-bda2-0a2dbbdaf445',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'debbie@pmgrp.co.za',
    billingType: 'fixed',
    groupKey: 'Platina Motor Group',
    allowedDomains: [
      'https://www.icaurrustenburg.co.za/',
      'icaur-rustenburg.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f59e0b 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'mahindra-garden-route': {
    name: 'Mahindra Garden Route',
    branchCode: 'VDWG001',
    dealershipID: '71fa23b3-57a3-4ef6-9b8a-12eec469fab8',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'debbie@pmgrp.co.za',
    billingType: 'fixed',
    groupKey: 'Platina Motor Group',
    allowedDomains: [
      'https://www.mahindragardenroute.co.za/',
      'mahindra-garden-route.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#e00f2f',
      gradient: 'linear-gradient(135deg, #e00f2f 0%, #e00f2f 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'mahindra-rustenburg': {
    name: 'Mahindra Rustenburg',
    branchCode: 'VDW001',
    dealershipID: 'a6ae4792-3b5c-40d6-ae1c-5f91dddb0a8a',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'debbie@pmgrp.co.za',
    billingType: 'fixed',
    groupKey: 'Platina Motor Group',
    allowedDomains: [
      'https://www.mahindrarustenburg.co.za/',
      'mahindra-rustenburg.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#e00f2f',
      gradient: 'linear-gradient(135deg, #e00f2f 0%, #e00f2f 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'jeep-rustenburg': {
    name: 'Jeep Rustenburg',
    branchCode: 'VDWG003',
    dealershipID: '0465f030-37f1-417a-ba02-ed087cb7cce0',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'debbie@pmgrp.co.za',
    billingType: 'fixed',
    groupKey: 'Platina Motor Group',
    allowedDomains: [
      'https://www.jeeprustenburg.co.za/',
      'jeep-rustenburg.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#42766a',
      gradient: 'linear-gradient(135deg, #42766a 0%, #42766a 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'yourcarguy': {
    name: 'YourCarGuy',
    branchCode: 'YCGY001',
    dealershipID: '6D551C34-6854-41DC-A3CD-C2ACEE0F4DD6',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'sales@yourcarguy.co.za',
    billingType: 'fixed',
    groupKey: '',
    allowedDomains: [
      'https://yourcarguy.co.za/',
      'yourcarguy.seritifinance.findndrive.co.za',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#111827',
      gradient: 'linear-gradient(135deg, #111827 0%, #111827 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },

  'car-factory-outlet': {
    name: 'Car Factory Outlet',
    branchCode: 'SGHO005',
    dealershipID: '2c15f938-f6ed-4c7d-af11-96826c86168c',
    financeType: 'vehicle',
    edithEnv: 'prod',
    contactEmail: 'mpho@findndrive.co.za',
    billingType: 'transaction',
    groupKey: '',
    allowedDomains: [
      'carfo.co.za',
      'car-factory-outlet.seritifinance.findndrive.co.za',
'car-factory-outlet.seritifinance.findndrive.co.za',
'e-fficient-ui-standalone-application.still-fire-1c3d.workers.dev',
      'seritifinance.findndrive.co.za',
    ],
    theme: {
      primary: '#f04438',
      gradient: 'linear-gradient(135deg, #f04438 0%, #f04438 100%)',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
    },
    features: {
      showDeposit: true,
      showCurrentFinance: true,
      vehicleQueryParams: true,
      showVehicleSelection: true,
    },
  },
  // ─────────────────────────────────────────────────────────────
  // ADD MORE DEALERS BELOW — copy a block, change the values
  // ─────────────────────────────────────────────────────────────
};

// ── Lookup helpers ────────────────────────────────────────────

export function getDealerConfig(dealerKey, referringDomain) {
  if (dealerKey && DEALERS[dealerKey]) {
    return { key: dealerKey, ...DEALERS[dealerKey] };
  }

  if (referringDomain) {
    const hostname = referringDomain.replace(/^https?:\/\//, '').split('/')[0];
    for (const [key, config] of Object.entries(DEALERS)) {
      if (config.allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        return { key, ...config };
      }
    }
  }

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

/**
 * Finds a dealer entry by its branchCode. Used when branchCode is
 * overridden via query param (multi-branch dealer group support, e.g.
 * Alpine Motors) so the accompanying dealershipID can be kept in sync
 * with the resolved branch rather than left stale from whichever dealer
 * X-Dealer-Key/origin originally resolved to.
 */
export function getDealerByBranchCode(branchCode) {
  if (!branchCode) return null;
  for (const [key, config] of Object.entries(DEALERS)) {
    if (config.branchCode === branchCode) {
      return { key, ...config };
    }
  }
  return null;
}

/**
 * Returns all dealer entries sharing a given groupKey, in the same
 * { key, ...config } shape as getDealerConfig. Used by billing-worker and
 * the analytics dashboard to roll up metrics/invoices across a dealer group.
 */
export function getDealersByGroup(groupKey) {
  if (!groupKey) return [];
  return Object.entries(DEALERS)
    .filter(([, config]) => config.groupKey === groupKey)
    .map(([key, config]) => ({ key, ...config }));
}

/**
 * Returns a map of groupKey -> array of dealer entries, for every dealer
 * that belongs to a group. Standalone dealers (groupKey === null) are
 * excluded. Useful for iterating "all groups" in a billing or reporting run.
 */
export function getAllDealerGroups() {
  const groups = new Map();
  for (const [key, config] of Object.entries(DEALERS)) {
    if (!config.groupKey) continue;
    if (!groups.has(config.groupKey)) groups.set(config.groupKey, []);
    groups.get(config.groupKey).push({ key, ...config });
  }
  return groups;
}
