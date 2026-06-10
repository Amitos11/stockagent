// ~520 ticker universe — US large/mid-cap by sector + Israeli NASDAQ + TASE.
//
// The universe is defined ONCE, grouped by sector, in `UNIVERSE` below.
// `TICKERS`, `SECTOR_MAP`, and `ALL_TICKERS` are all derived from it, so adding
// a symbol in one place keeps the ticker list and its sector colour in sync.

export type SectorKey =
  | "Tech"
  | "Semis"
  | "Software"
  | "Healthcare"
  | "Consumer"
  | "Finance"
  | "Energy"
  | "Industrial"
  | "Israel"
  | "TASE";

// ── Sector-grouped universe (US + Israeli NASDAQ) ───────────────────────────────
// First sector a symbol appears in wins (dedup is handled in the derivation step).

const UNIVERSE: Record<Exclude<SectorKey, "TASE">, string[]> = {
  // Mega-cap tech, communication services, media & networking hardware
  Tech: [
    "AAPL", "MSFT", "GOOGL", "GOOG", "META", "AMZN", "TSLA", "NFLX",
    "DIS", "CMCSA", "T", "VZ", "TMUS", "CSCO", "IBM", "DELL", "HPQ", "HPE",
    "NTAP", "STX", "WDC", "GLW", "JNPR", "FFIV", "ANET", "MSI", "GEN",
    "TTWO", "EA", "WBD", "PARA", "FOXA", "FOX", "OMC", "IPG", "LYV",
    "NWSA", "MTCH", "GRMN", "KEYS", "ZBRA", "TDY", "TRMB", "PTC", "CIEN",
    "WDAY",
  ],

  // Semiconductors & semiconductor equipment
  Semis: [
    "NVDA", "AVGO", "AMD", "MU", "QCOM", "AMAT", "LRCX", "ASML", "KLAC",
    "TSM", "ARM", "INTC", "TXN", "MRVL", "ON", "MCHP", "ADI", "SWKS",
    "NXPI", "MPWR", "TER", "ENTG", "QRVO", "LSCC", "GFS", "SMCI", "STM",
    "ONTO", "AMKR", "UCTT", "FORM",
  ],

  // Software, cloud, security, internet & fintech-software
  Software: [
    "ORCL", "ADBE", "CRM", "NOW", "INTU", "PLTR", "CRWD", "NET", "DDOG",
    "ZS", "PANW", "FTNT", "SNOW", "MDB", "VEEV", "HUBS", "TWLO", "OKTA",
    "BILL", "GTLB", "TEAM", "DOCU", "ZM", "SHOP", "APP", "DUOL", "TTD",
    "RBLX", "SNAP", "PINS", "U", "PATH", "S", "CFLT", "FROG", "ESTC",
    "DBX", "BOX", "PCOR", "BRZE", "GWRE", "MANH", "TYL", "PEGA", "APPF",
    "FICO", "ADSK", "ANSS", "CDNS", "SNPS", "EPAM", "CTSH", "ACN", "AKAM",
    "FSLY", "DOCN", "AI", "ZI", "INFA", "SMAR", "ASAN", "MSTR", "DT",
    "GDDY", "VRSN", "CDW", "GLOB", "BSY", "OTEX", "QTWO", "BLKB", "ALTR",
  ],

  // Healthcare — pharma, biotech, devices, payers & services
  Healthcare: [
    "UNH", "LLY", "JNJ", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "BMY",
    "AMGN", "ISRG", "GILD", "VRTX", "REGN", "CVS", "CI", "ELV", "HUM",
    "CNC", "MCK", "COR", "CAH", "ZTS", "BSX", "MDT", "SYK", "EW", "BDX",
    "BAX", "A", "IDXX", "IQV", "RMD", "DXCM", "ALGN", "MTD", "WST", "STE",
    "HOLX", "RVTY", "BIO", "TECH", "PODD", "MRNA", "BIIB", "INCY", "HCA",
    "UHS", "DVA", "LH", "DGX", "CRL", "WAT", "COO", "ZBH", "GEHC", "SOLV",
    "VTRS", "CTLT", "MOH", "TFX", "BMRN", "EXAS", "NBIX", "ITCI", "HALO",
    "ENSG", "CHE", "MEDP", "RGEN", "TWST", "THC",
  ],

  // Consumer discretionary + consumer staples
  Consumer: [
    "HD", "LOW", "NKE", "MCD", "SBUX", "TGT", "LULU", "TJX", "BKNG",
    "ABNB", "CMG", "ROST", "ORLY", "AZO", "YUM", "MAR", "HLT", "RCL",
    "CCL", "NCLH", "DHI", "LEN", "NVR", "PHM", "F", "GM", "APTV", "BWA",
    "LVS", "WYNN", "MGM", "CZR", "EBAY", "ETSY", "W", "CHWY", "DPZ", "DRI",
    "EXPE", "KMX", "BBY", "ULTA", "TSCO", "POOL", "GPC", "LKQ", "WSM",
    "RL", "TPR", "DECK", "HAS", "MAT", "NWL",
    "WMT", "COST", "PG", "KO", "PEP", "PM", "MO", "MDLZ", "CL", "KMB",
    "GIS", "KHC", "SYY", "ADM", "HSY", "STZ", "KDP", "MNST", "KR", "CAG",
    "CPB", "HRL", "MKC", "CHD", "CLX", "TSN", "TAP", "BG", "EL", "KVUE",
    "DG", "DLTR", "DKNG", "CAVA", "WING", "TXRH", "CROX", "FND", "LAD",
    "YETI",
  ],

  // Financials — banks, payments, insurers, asset managers & exchanges
  Finance: [
    "JPM", "BAC", "WFC", "C", "GS", "MS", "V", "MA", "AXP", "BLK", "SCHW",
    "SPGI", "MMC", "CB", "PGR", "AON", "ICE", "CME", "MCO", "PNC", "USB",
    "TFC", "COF", "BK", "STT", "FITB", "HBAN", "RF", "CFG", "KEY", "MTB",
    "ALL", "TRV", "AFL", "MET", "PRU", "AIG", "ACGL", "HIG", "AJG", "BRO",
    "WTW", "FIS", "FI", "GPN", "PYPL", "COIN", "HOOD", "SOFI", "AFRM",
    "XYZ", "NDAQ", "CBOE", "MKTX", "AMP", "RJF", "TROW", "BEN", "IVZ",
    "NTRS", "DFS", "SYF", "FDS", "CINF", "WRB", "MKL", "GL", "AIZ",
    "JKHY", "EWBC", "WAL", "ZION", "SNV", "OZK", "RNR",
  ],

  // Energy — integrated, E&P, services & midstream
  Energy: [
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB",
    "KMI", "OKE", "HES", "DVN", "FANG", "HAL", "BKR", "TRGP",
    "APA", "EQT", "LNG", "ET", "EPD", "MPLX", "PAA", "FSLR", "ENPH",
    "FE", "EIX",
  ],

  // Industrials, aerospace & defense, transports
  Industrial: [
    "CAT", "DE", "HON", "GE", "GEV", "RTX", "LMT", "BA", "NOC", "GD",
    "UNP", "UPS", "FDX", "CSX", "NSC", "MMM", "EMR", "ETN", "ITW", "PH",
    "ROK", "CMI", "PCAR", "GWW", "FAST", "URI", "JCI", "CARR", "OTIS",
    "TT", "IR", "DOV", "AME", "ROP", "FTV", "XYL", "PNR", "NDSN", "IEX",
    "GGG", "AOS", "LII", "WAB", "J", "PWR", "EME", "ACM", "JBHT", "ODFL",
    "CHRW", "EXPD", "LUV", "DAL", "UAL", "AAL", "ALK", "AXON", "TDG",
    "HWM", "HEI", "TXT", "LHX", "HII", "VRSK", "RSG", "WM", "ROL", "CTAS",
    "PAYX", "ADP", "EFX",
  ],

  // Israeli companies listed on US exchanges (NASDAQ/NYSE)
  Israel: [
    "CHKP", "NICE", "MNDY", "WIX", "GLBE", "CYBR", "TEVA", "RDNT", "SEDG",
    "FROG", "GTLB", "INMD", "NVMI", "CAMT", "ALAR",
  ],
};

// Tel Aviv Stock Exchange (".TA" suffix — handled separately by the data layer)
export const TASE_TICKERS = [
  "POLI.TA", "LUMI.TA", "DSCT.TA", "MZTF.TA", "FIBI.TA",
  "ICL.TA", "AZRG.TA", "EMMT.TA", "DLEKG.TA", "ORL.TA",
  "ESLT.TA", "NICE.TA", "TEVA.TA", "NVMI.TA", "CAMT.TA",
] as const;

// ── Derivation — dedup, first-sector-wins ───────────────────────────────────────

export const SECTOR_ORDER: SectorKey[] = [
  "Tech", "Semis", "Software", "Healthcare",
  "Consumer", "Finance", "Energy", "Industrial",
  "Israel", "TASE",
];

const _sectorMap: Record<string, SectorKey> = {};
const _usSymbols: string[] = [];

for (const sector of SECTOR_ORDER) {
  if (sector === "TASE") continue;
  for (const sym of UNIVERSE[sector]) {
    if (sym in _sectorMap) continue; // dedup — first sector wins
    _sectorMap[sym] = sector;
    _usSymbols.push(sym);
  }
}
for (const sym of TASE_TICKERS) {
  if (sym in _sectorMap) continue;
  _sectorMap[sym] = "TASE";
}

/** All US/NASDAQ-listed symbols (excludes ".TA"). */
export const TICKERS = _usSymbols;

/** Full scan universe — US symbols followed by TASE symbols. ~520 total. */
export const ALL_TICKERS = [...TICKERS, ...TASE_TICKERS] as const;

export type Ticker = (typeof ALL_TICKERS)[number];

export const SECTOR_MAP: Record<string, SectorKey> = _sectorMap;

/** Israeli stocks — NASDAQ-listed + TASE. They sit at the tail of ALL_TICKERS,
 *  so a partial scan (e.g. 500) drops them; the scan always unions these in. */
export const ISRAELI_TICKERS: string[] = ALL_TICKERS.filter(
  (s) => _sectorMap[s] === "Israel" || _sectorMap[s] === "TASE"
);

export function getSector(symbol: string): SectorKey {
  return SECTOR_MAP[symbol] ?? (symbol.endsWith(".TA") ? "TASE" : "Tech");
}

// ── Sector display metadata ─────────────────────────────────────────────────────

export interface SectorMeta {
  label: string;
  cssClass: string;
  color: string;
  market: "US" | "IL";
}

export const SECTOR_META: Record<SectorKey, SectorMeta> = {
  Tech:       { label: "Mega-cap Tech",  cssClass: "sector-tech",       color: "#6366f1", market: "US" },
  Semis:      { label: "Semis & HW",     cssClass: "sector-semis",      color: "#8b5cf6", market: "US" },
  Software:   { label: "Software/Cloud", cssClass: "sector-software",   color: "#22d3ee", market: "US" },
  Healthcare: { label: "Healthcare",     cssClass: "sector-healthcare", color: "#10b981", market: "US" },
  Consumer:   { label: "Consumer",       cssClass: "sector-consumer",   color: "#f59e0b", market: "US" },
  Finance:    { label: "Financials",     cssClass: "sector-finance",    color: "#3b82f6", market: "US" },
  Energy:     { label: "Energy",         cssClass: "sector-energy",     color: "#f97316", market: "US" },
  Industrial: { label: "Industrials",    cssClass: "sector-industrial", color: "#94a3b8", market: "US" },
  Israel:     { label: "Israel NASDAQ",  cssClass: "sector-israel",     color: "#60a5fa", market: "IL" },
  TASE:       { label: "TASE",           cssClass: "sector-tase",       color: "#34d399", market: "IL" },
};

export const BUFFETT_QUOTES = [
  { text: "Price is what you pay. Value is what you get.", context: "On value investing" },
  { text: "Be fearful when others are greedy and greedy when others are fearful.", context: "On market timing" },
  { text: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", context: "On quality" },
  { text: "Our favorite holding period is forever.", context: "On long-term thinking" },
  { text: "The stock market is a device for transferring money from the impatient to the patient.", context: "On patience" },
  { text: "Risk comes from not knowing what you're doing.", context: "On risk management" },
  { text: "In the short run, the market is a voting machine, but in the long run it is a weighing machine.", context: "On market behavior" },
  { text: "Time is the friend of the wonderful company, the enemy of the mediocre.", context: "On holding quality" },
  { text: "Never invest in a business you cannot understand.", context: "On circle of competence" },
  { text: "The most important quality for an investor is temperament, not intellect.", context: "On psychology" },
  { text: "Diversification is protection against ignorance. It makes little sense if you know what you are doing.", context: "On concentration" },
  { text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.", context: "On contrarian investing" },
  { text: "Someone's sitting in the shade today because someone planted a tree a long time ago.", context: "On compounding" },
  { text: "Only buy something that you'd be perfectly happy to hold if the market shut down for 10 years.", context: "On conviction" },
  { text: "Rule No.1: Never lose money. Rule No.2: Never forget rule No.1.", context: "On capital preservation" },
  { text: "The difference between successful people and really successful people is that really successful people say no to almost everything.", context: "On focus" },
  { text: "We simply attempt to be fearful when others are greedy and to be greedy only when others are fearful.", context: "On contrarian approach" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", context: "On knowledge" },
  { text: "The best investment you can make is in yourself.", context: "On self-improvement" },
  { text: "An investor should act as though he had a lifetime decision card with just 20 punches on it.", context: "On selectivity" },
  { text: "It takes 20 years to build a reputation and five minutes to ruin it.", context: "On integrity" },
  { text: "Look at market fluctuations as your friend rather than your enemy; profit from folly rather than participate in it.", context: "On volatility" },
];
