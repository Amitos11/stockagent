export interface StockRow {
  symbol: string;
  name?: string;
  price?: number;
  currency?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  marketCapDisplay?: string;
  // Valuation
  peRatio?: number;
  forwardPE?: number;
  pegRatio?: number;
  // Growth
  earningsGrowth?: number;
  revenueGrowth?: number;
  // Profitability
  operatingMargin?: number;
  profitMargin?: number;
  roe?: number;
  // Balance sheet
  debtToEquity?: number;
  currentRatio?: number;
  // Financials TTM
  financialCurrency?: string;
  totalRevenue?: number;
  grossProfits?: number;
  ebitda?: number;
  netIncomeTTM?: number;
  opIncomeTTM?: number;
  // Analyst targets
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  numAnalysts?: number;
  recommendationKey?: string;
  recommendationMean?: number;
  // Price action
  dayChange?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  nextEarnings?: string;
  // Scores — weighted contributions (sum to `score`)
  scoreGrowth?: number;
  scoreProfitability?: number;
  scoreValuation?: number;
  score?: number;
  // Raw pillar quality on a 0–100 scale, independent of weight.
  // Used by the drawer pillars and for instant client-side re-ranking.
  qualityGrowth?: number;
  qualityProfitability?: number;
  qualityValuation?: number;
  // Financial-health multiplier (0.70–1.0) applied to the composite score.
  healthFactor?: number;
  insight?: string;
  // Enrichment (Top 10 only)
  news?: NewsItem[];
  management?: Management;
  quarterly?: QuarterlyData;
  forecasts?: ForwardEstimates;
  lastEarnings?: EarningsHistory;
  analyst?: AnalystData;
  // Value investing flags
  isValuePlay?: boolean;
  rank?: number;
  error?: string;
}

export interface NewsItem {
  title: string;
  link?: string;
  source?: string;
  published?: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface Management {
  ceo?: Officer;
  cfo?: Officer;
}

export interface Officer {
  name: string;
  title?: string;
  age?: number;
}

export interface QuarterlyData {
  qDate?: string;
  qRevenue?: number;
  qOperatingIncome?: number;
  qNetIncome?: number;
}

export interface ForwardEstimates {
  nextQEps?: number;
  nextQEpsGrowth?: number;
  nextQRevenue?: number;
  nextQRevenueGrowth?: number;
  nextYEps?: number;
  nextYEpsGrowth?: number;
  nextYRevenue?: number;
  nextYRevenueGrowth?: number;
}

export interface EarningsHistory {
  reportDate?: string;
  epsActual?: number;
  epsEstimate?: number;
  epsDifference?: number;
  surprisePct?: number;
  beat?: boolean;
}

export interface AnalystData {
  targetMean?: number | null;
  targetHigh?: number | null;
  targetLow?: number | null;
  numAnalysts?: number | null;
  recommendationKey?: string;
  recommendationMean?: number | null;
}

export interface ScanWeights {
  growth: number;
  profitability: number;
  valuation: number;
}

export interface ScanResult {
  allRows: StockRow[];
  valid: StockRow[];
  top10: StockRow[];
  scannedAt: string;
  weights: ScanWeights;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}
