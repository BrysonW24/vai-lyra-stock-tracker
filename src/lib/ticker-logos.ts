/**
 * Ticker → company domain map, used to render real company logos (via favicon)
 * across the console so the operator can trace names at a glance.
 *
 * Returns a domain for known tickers; unknown tickers return null and callers
 * fall back to a deterministic coloured letter badge.
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

/** Resolve a ticker to a company domain, or null if unknown. */
export function tickerDomain(symbol: string): string | null {
  return TICKER_DOMAINS[symbol.toUpperCase()] ?? null;
}

/** The full set of known ticker symbols, sorted - for autocomplete / suggestions. */
export function allTickerSymbols(): string[] {
  return Object.keys(TICKER_DOMAINS).sort();
}
