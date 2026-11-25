/*
Saved settings: the user's wallets and export defaults.
A wallet is one installation, for example Zelcore LLC, and holds many addresses.
Kept in this browser (localStorage) only. The backup file holds the same data.
*/
import { CSVFormat, MintSummaryPeriod } from './wallet.js';

export interface SavedAddress {
  id: string;
  wallet: string;
  name: string;
  address: string;
}

export interface Settings {
  version: 2;
  addresses: SavedAddress[];
  csvFormat: CSVFormat;
  walletFormats: { [wallet: string]: CSVFormat };
  mintSummary: MintSummaryPeriod;
}

const STORAGE_KEY = 'fluxexport-settings';
const MAX_NAME = 40;
const UNNAMED_WALLET = 'My wallet';

export function defaultSettings(): Settings {
  return { version: 2, addresses: [], csvFormat: CSVFormat.CoinTracker, walletFormats: {}, mintSummary: MintSummaryPeriod.None };
}

export function isFluxAddress(address: string): boolean {
  return /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function isFormat(value: unknown): value is CSVFormat {
  return Object.values(CSVFormat).includes(value as CSVFormat);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : '';
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Check settings read from storage or a backup file. Throws when they are not FluxExport settings. */
export function parseSettings(text: string): Settings {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This is not a FluxExport settings file.');
  }
  // Version 1 (FluxExport 1.7) kept "owner" where version 2 keeps "wallet"
  const entries = raw?.version === 1 ? raw.wallets : raw?.version === 2 ? raw.addresses : null;
  const formats = raw?.version === 1 ? raw.ownerFormats : raw?.walletFormats;
  if (!Array.isArray(entries)) throw new Error('This is not a FluxExport settings file.');

  const settings = defaultSettings();
  entries.forEach((entry: any, index: number) => {
    const address = typeof entry?.address === 'string' ? entry.address.trim() : '';
    if (!isFluxAddress(address)) throw new Error(`Entry ${index + 1} in this file does not have a Flux address.`);
    if (settings.addresses.some(saved => saved.address === address)) return;
    settings.addresses.push({
      id: newId(),
      wallet: spelledAs(settings, cleanText(raw.version === 1 ? entry.owner : entry.wallet) || UNNAMED_WALLET),
      name: cleanText(entry.name) || address,
      address,
    });
  });
  if (isFormat(raw.csvFormat)) settings.csvFormat = raw.csvFormat;
  if (Object.values(MintSummaryPeriod).includes(raw.mintSummary)) settings.mintSummary = raw.mintSummary;
  if (formats && typeof formats === 'object') {
    for (const wallet of walletNames(settings)) {
      const format = Object.prototype.hasOwnProperty.call(formats, wallet) ? formats[wallet] : undefined;
      if (isFormat(format)) settings.walletFormats[wallet] = format;
    }
  }
  tidy(settings);
  return settings;
}

export function loadSettings(): Settings {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) return parseSettings(text);
  } catch (error) {
    console.error('Unable to load the saved settings', error);
  }
  return defaultSettings();
}

/** False when this browser would not store them. */
export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, settingsText(settings));
    return true;
  } catch (error) {
    console.error('Unable to save the settings', error);
    return false;
  }
}

export function settingsText(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

/** Wallets with an address, in name order. */
export function walletNames(settings: Settings): string[] {
  return Array.from(new Set(settings.addresses.map(saved => saved.wallet))).sort((a, b) => a.localeCompare(b));
}

export function addressesOf(settings: Settings, wallet: string): SavedAddress[] {
  return settings.addresses.filter(saved => saved.wallet === wallet).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatFor(settings: Settings, saved: SavedAddress | null): CSVFormat {
  if (saved && Object.prototype.hasOwnProperty.call(settings.walletFormats, saved.wallet)) return settings.walletFormats[saved.wallet];
  return settings.csvFormat;
}

/** The mining summary is for Koinly only. */
export function usesKoinly(settings: Settings): boolean {
  return settings.csvFormat === CSVFormat.Koinly || Object.values(settings.walletFormats).includes(CSVFormat.Koinly);
}

/** Add an address, or change the one with this id. Returns what is wrong with it, or "". */
export function putAddress(settings: Settings, id: string, wallet: string, name: string, address: string): string {
  const clean = { wallet: spelledAs(settings, cleanText(wallet)), name: cleanText(name), address: address.trim() };
  if (!clean.wallet) return 'Enter the wallet this address is in.';
  if (!clean.name) return 'Enter a name for the address.';
  if (!isFluxAddress(clean.address)) return 'Enter a Flux address: t1 or t3 and 35 characters in all.';
  const others = settings.addresses.filter(saved => saved.id !== id);
  const same = others.find(saved => saved.address === clean.address);
  if (same) return `That address is already saved as ${same.wallet}: ${same.name}.`;
  if (others.some(saved => saved.wallet === clean.wallet && saved.name.toLowerCase() === clean.name.toLowerCase())) {
    return `${clean.wallet} already has an address named ${clean.name}.`;
  }
  const existing = settings.addresses.find(saved => saved.id === id);
  if (existing) Object.assign(existing, clean);
  else settings.addresses.push({ id: newId(), ...clean });
  tidy(settings);
  return '';
}

export function removeAddress(settings: Settings, id: string): void {
  settings.addresses = settings.addresses.filter(saved => saved.id !== id);
  tidy(settings);
}

/** Returns what is wrong with the new name, or "". */
export function renameWallet(settings: Settings, wallet: string, newName: string): string {
  const clean = cleanText(newName);
  if (!clean) return 'Enter a name for the wallet.';
  if (walletNames(settings).some(other => other !== wallet && other.toLowerCase() === clean.toLowerCase())) return `There is already a wallet named ${clean}.`;
  settings.addresses.filter(saved => saved.wallet === wallet).forEach(saved => { saved.wallet = clean; });
  const format = settings.walletFormats[wallet];
  delete settings.walletFormats[wallet];
  if (format) settings.walletFormats[clean] = format;
  return '';
}

export function setDefaultFormat(settings: Settings, format: CSVFormat): void {
  settings.csvFormat = format;
  tidy(settings);
}

/** "" for the default format. */
export function setWalletFormat(settings: Settings, wallet: string, format: CSVFormat | ''): void {
  if (format === '') delete settings.walletFormats[wallet];
  else settings.walletFormats[wallet] = format;
  tidy(settings);
}

/** The name of a saved wallet that differs only in upper and lower case, else the name as given. */
function spelledAs(settings: Settings, wallet: string): string {
  return settings.addresses.find(saved => saved.wallet.toLowerCase() === wallet.toLowerCase())?.wallet ?? wallet;
}

function tidy(settings: Settings): void {
  const used = walletNames(settings);
  Object.keys(settings.walletFormats).forEach(wallet => {
    if (!used.includes(wallet)) delete settings.walletFormats[wallet];
  });
  if (!usesKoinly(settings)) settings.mintSummary = MintSummaryPeriod.None;
}

/** For example Zelcore-LLC-Mining_2026-01-01_2026-11-25.csv */
export function suggestFileName(saved: SavedAddress | null, address: string, start: string, end: string, today: string): string {
  const slug = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let who = address ? address.slice(0, 8) : 'wallet';
  if (saved) {
    const name = slug(saved.name);
    const wallet = slug(saved.wallet);
    const hasWallet = wallet === '' || name.toLowerCase() === wallet.toLowerCase() || name.toLowerCase().startsWith(`${wallet.toLowerCase()}-`);
    who = (hasWallet ? name : `${wallet}-${name}`) || address.slice(0, 8);
  }
  return `${slug(who)}_${start || 'all'}_${end || today}.csv`;
}
