/*
FLUX/USD prices by hour (UTC).

1. flux.json, bundled with the app
2. DefiLlama: free, no key, history back to 2018-07-30
3. Binance public market data: free, no key, FLUXUSDT back to 2021-12-10

Both live sources allow cross-site browser calls. An hour is looked up in that order, and
only the hours not in flux.json are fetched, one 500 hour block at a time.
*/

const HOUR = 60 * 60;
const BLOCK_HOURS = 500; // the most points DefiLlama returns in one call
const BLOCK_SECONDS = BLOCK_HOURS * HOUR;
const MAX_PRICE_AGE_HOURS = 12; // the longest hole in the DefiLlama history is 8 hours
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 20_000;

interface FluxPricePoint {
  timestamp: number;
  price: number;
}

interface PriceSource {
  name: string;
  firstTimestamp: number;
  fetchBlock: (start: number, hours: number) => Promise<FluxPricePoint[]>;
}

/** Thrown when a transaction needs a price and no source has one. */
export class MissingPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingPriceError";
  }
}

const hourlyPrices: Map<number, number> = new Map();
let bundledLoad: Promise<void> | null = null;
const loadedBlocks: Set<string> = new Set(); // complete blocks, kept until the caches are cleared
const runBlocks: Map<string, Promise<void>> = new Map(); // blocks asked for during this export
const unreachable: Set<string> = new Set(); // sources that failed during this export

const sources: PriceSource[] = [
  { name: "DefiLlama", firstTimestamp: 1532933789, fetchBlock: fetchDefiLlama },
  { name: "Binance", firstTimestamp: 1639116000, fetchBlock: fetchBinance },
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hourOf(timestamp: number): number {
  return Math.floor(timestamp / HOUR) * HOUR;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isFluxPricePoint(entry: unknown): entry is FluxPricePoint {
  if (typeof entry !== "object" || entry === null) return false;
  const { timestamp, price } = entry as FluxPricePoint;
  return Number.isFinite(timestamp) && Number.isFinite(price) && price > 0;
}

async function fetchJson(url: URL): Promise<any> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    let retry = true;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.ok) return await response.json();
      lastError = new Error(`${url.host} answered ${response.status}`);
      retry = response.status === 429 || response.status >= 500;
    } catch (error) {
      lastError = error;
    }
    if (!retry) break;
    if (attempt < FETCH_ATTEMPTS) await sleep(attempt * 1500);
  }
  throw lastError;
}

async function fetchDefiLlama(start: number, hours: number): Promise<FluxPricePoint[]> {
  const url = new URL("https://coins.llama.fi/chart/coingecko:zelcash");
  url.searchParams.set("start", String(start));
  url.searchParams.set("span", String(hours));
  url.searchParams.set("period", "1h");
  // Without this only points within 6 minutes of the hour are returned and whole weeks come back empty
  url.searchParams.set("searchWidth", "30m");
  const data = await fetchJson(url);
  if (!data || typeof data.coins !== "object" || data.coins === null) throw new Error("Unexpected DefiLlama answer");
  const points = data.coins["coingecko:zelcash"]?.prices ?? [];
  if (!Array.isArray(points)) throw new Error("Unexpected DefiLlama answer");
  // Points are a few minutes either side of the hour
  return points.filter(isFluxPricePoint).map(point => ({
    timestamp: Math.round(point.timestamp / HOUR) * HOUR,
    price: point.price,
  }));
}

async function fetchBinance(start: number, hours: number): Promise<FluxPricePoint[]> {
  const url = new URL("https://data-api.binance.vision/api/v3/klines");
  url.searchParams.set("symbol", "FLUXUSDT");
  url.searchParams.set("interval", "1h");
  url.searchParams.set("startTime", String(start * 1000));
  url.searchParams.set("endTime", String((start + hours * HOUR) * 1000 - 1));
  url.searchParams.set("limit", String(hours));
  const data = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error("Unexpected Binance answer");
  // [open time, open, high, low, close, ...]; the open is the price at the start of the hour
  return data
    .map((candle: any) => ({ timestamp: Number(candle?.[0]) / 1000, price: Number(candle?.[1]) }))
    .filter(isFluxPricePoint);
}

async function loadBundledPrices(): Promise<void> {
  if (!bundledLoad) {
    bundledLoad = (async () => {
      try {
        // prices.js sits next to flux.json in dist/, so a local relative URL works when served.
        const fluxUrl = new URL("./flux.json", import.meta.url);
        const response = await fetch(fluxUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const data = await response.json();
        if (!Array.isArray(data?.prices)) throw new Error("no prices in flux.json");
        data.prices.filter(isFluxPricePoint).forEach((point: FluxPricePoint) => {
          hourlyPrices.set(hourOf(point.timestamp), point.price);
        });
      } catch (error) {
        console.error("Unable to load flux.json, using the live price sources only", error);
      }
    })();
  }
  return bundledLoad;
}

async function loadBlock(source: PriceSource, hour: number): Promise<void> {
  const start = Math.floor(hour / BLOCK_SECONDS) * BLOCK_SECONDS;
  const key = `${source.name}:${start}`;
  if (start + BLOCK_SECONDS <= source.firstTimestamp) return;
  if (loadedBlocks.has(key) || unreachable.has(source.name)) return;

  let load = runBlocks.get(key);
  if (!load) {
    load = (async () => {
      const now = nowSeconds();
      const hours = Math.min(BLOCK_HOURS, Math.floor((now - start) / HOUR) + 1);
      try {
        const points = await source.fetchBlock(start, hours);
        points.forEach(point => {
          // An earlier source in the list wins
          if (!hourlyPrices.has(point.timestamp)) hourlyPrices.set(point.timestamp, point.price);
        });
        if (start + BLOCK_SECONDS <= now) loadedBlocks.add(key);
      } catch (error) {
        console.error(`${source.name} prices unavailable`, error);
        unreachable.add(source.name);
      }
    })();
    runBlocks.set(key, load);
  }
  return load;
}

/** Call at the start of an export: retry failed sources and refresh the newest prices. */
export function startPriceRun(): void {
  runBlocks.clear();
  unreachable.clear();
}

export function clearPrices(): void {
  startPriceRun();
  hourlyPrices.clear();
  loadedBlocks.clear();
  bundledLoad = null;
}

/** FLUX price in USD for the hour holding dateTime (epoch seconds), null if no source has one. */
export async function getPrice(dateTime: number): Promise<number | null> {
  if (!Number.isFinite(dateTime)) return null;
  const hour = hourOf(dateTime);
  if (hour > nowSeconds()) return null;

  await loadBundledPrices();
  for (let back = 0; back <= MAX_PRICE_AGE_HOURS; back++) {
    const candidate = hour - back * HOUR;
    for (const source of sources) {
      if (hourlyPrices.has(candidate)) break;
      await loadBlock(source, candidate);
    }
    const price = hourlyPrices.get(candidate);
    if (price !== undefined) return price;
  }
  return null;
}

/** Same as getPrice, but a missing price is an error. */
export async function requirePrice(dateTime: number, txid: string): Promise<number> {
  const price = await getPrice(dateTime);
  if (price !== null) return price;
  const when = Number.isFinite(dateTime) ? new Date(dateTime * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "unknown time";
  const reason = unreachable.size > 0
    ? `${Array.from(unreachable).join(" and ")} could not be reached. Try again in a few minutes.`
    : dateTime < sources[0].firstTimestamp
      ? "Prices start on 2018-07-30; use a later start date to leave this transaction out."
      : "No price source has that date.";
  throw new MissingPriceError(`No FLUX price for ${when} (transaction ${txid}). ${reason} Nothing was exported.`);
}
