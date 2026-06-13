/**
 * Logo routing - the single source of truth for turning a ticker (or any domain)
 * into a logo URL, used everywhere a company mark is surfaced.
 *
 * Resolution order for a ticker (best first):
 *   1. a curated local override under /public/logos (most reliable, offline-safe)
 *   2. the live favicon for the mapped company domain
 *   3. (caller) a deterministic coloured letter badge
 *
 * Always render through the shared `TickerLogo` component so the fallback chain and
 * contrast-safe chip are applied consistently - never hand-roll a favicon <img>.
 */
const TICKER_DOMAINS: Record<string, string> = {
  // Mega-cap platforms
  AAPL: 'apple.com', MSFT: 'microsoft.com', GOOGL: 'abc.xyz', GOOG: 'abc.xyz',
  META: 'meta.com', AMZN: 'amazon.com',
  // AI infrastructure / compute / networking
  NVDA: 'nvidia.com', AVGO: 'broadcom.com', TSM: 'tsmc.com', PLTR: 'palantir.com',
  SMCI: 'supermicro.com', DELL: 'dell.com', ANET: 'arista.com', CRWV: 'coreweave.com',
  NBIS: 'nebius.com', VRT: 'vertiv.com',
  // Semiconductors / equipment
  AMD: 'amd.com', INTC: 'intel.com', MU: 'micron.com', QCOM: 'qualcomm.com',
  TXN: 'ti.com', AMAT: 'appliedmaterials.com', LRCX: 'lamresearch.com', KLAC: 'kla.com',
  ASML: 'asml.com', ARM: 'arm.com', MRVL: 'marvell.com', NXPI: 'nxp.com', ADI: 'analog.com',
  MCHP: 'microchip.com', ON: 'onsemi.com', QRVO: 'qorvo.com', SWKS: 'skyworksinc.com',
  GFS: 'gf.com', WOLF: 'wolfspeed.com', ENTG: 'entegris.com', TER: 'teradyne.com', COHR: 'coherent.com',
  // Software
  CRM: 'salesforce.com', ADBE: 'adobe.com', NOW: 'servicenow.com', INTU: 'intuit.com',
  TEAM: 'atlassian.com', WDAY: 'workday.com', MDB: 'mongodb.com', SHOP: 'shopify.com',
  CDNS: 'cadence.com', SNPS: 'synopsys.com', APP: 'applovin.com', IBM: 'ibm.com',
  ADSK: 'autodesk.com', ANSS: 'ansys.com', PTC: 'ptc.com', HUBS: 'hubspot.com',
  DOCU: 'docusign.com', GTLB: 'gitlab.com', PATH: 'uipath.com', AI: 'c3.ai',
  TWLO: 'twilio.com', ZM: 'zoom.us', DBX: 'dropbox.com', CTSH: 'cognizant.com', ROP: 'ropertech.com',
  // Cloud & data
  SNOW: 'snowflake.com', DDOG: 'datadoghq.com', NET: 'cloudflare.com', ESTC: 'elastic.co',
  PSTG: 'purestorage.com', NTAP: 'netapp.com', DOCN: 'digitalocean.com', CFLT: 'confluent.io',
  ORCL: 'oracle.com', CSCO: 'cisco.com', WDC: 'westerndigital.com',
  // Cybersecurity
  PANW: 'paloaltonetworks.com', CRWD: 'crowdstrike.com', FTNT: 'fortinet.com', ZS: 'zscaler.com',
  S: 'sentinelone.com', OKTA: 'okta.com', CYBR: 'cyberark.com', QLYS: 'qualys.com',
  TENB: 'tenable.com', RPD: 'rapid7.com', VRNS: 'varonis.com', AKAM: 'akamai.com',
  // Consumer internet
  NFLX: 'netflix.com', UBER: 'uber.com', TSLA: 'tesla.com', DASH: 'doordash.com',
  ABNB: 'airbnb.com', RBLX: 'roblox.com', SPOT: 'spotify.com', PINS: 'pinterest.com',
  SNAP: 'snap.com', RDDT: 'redditinc.com', MAR: 'marriott.com',
  // Fintech
  PYPL: 'paypal.com', COIN: 'coinbase.com', HOOD: 'robinhood.com', XYZ: 'block.xyz',
  AFRM: 'affirm.com', SOFI: 'sofi.com',
};

/**
 * Curated overrides for tickers whose live favicon is poor (low-contrast, wrong, or
 * missing). A local asset wins over the favicon service. To add one: drop a file at
 * `public/logos/<file>` and map the ticker here, e.g. `AMD: '/logos/amd.svg'`.
 * The contrast-safe chip in TickerLogo already rescues dark favicons (like AMD's), so
 * an override is only needed when the favicon itself is wrong or unavailable.
 */
const LOGO_OVERRIDES: Record<string, string> = {};

/** Snap a requested pixel size to a favicon resolution the service actually serves. */
function faviconSize(size: number): number {
  if (size <= 16) return 32;
  if (size <= 32) return 64;
  return 128;
}

/** Favicon URL for any domain at a given on-screen size. Shared by channel/exchange marks too. */
export function faviconUrl(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${faviconSize(size)}`;
}

/** Resolve a ticker to its company domain, or null if unknown. */
export function tickerDomain(symbol: string): string | null {
  return TICKER_DOMAINS[symbol.toUpperCase()] ?? null;
}

/**
 * Ordered logo source URLs for a ticker, best first (override, then favicon). Callers
 * try each in order and fall back to a letter badge when the list is exhausted. Empty
 * when the ticker is unknown and has no override.
 */
export function tickerLogoSources(symbol: string, size = 32): string[] {
  const key = symbol.toUpperCase();
  const sources: string[] = [];
  if (LOGO_OVERRIDES[key]) sources.push(LOGO_OVERRIDES[key]);
  const domain = TICKER_DOMAINS[key];
  if (domain) sources.push(faviconUrl(domain, size));
  return sources;
}

/** Single best logo URL for a ticker, or null - for callers that don't need the fallback chain. */
export function tickerLogoUrl(symbol: string, size = 32): string | null {
  return tickerLogoSources(symbol, size)[0] ?? null;
}

/** The full set of known ticker symbols, sorted - for autocomplete / suggestions. */
export function allTickerSymbols(): string[] {
  return Object.keys(TICKER_DOMAINS).sort();
}
