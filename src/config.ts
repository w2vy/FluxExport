/*
Saved settings: the user's wallets and export defaults.
Kept in this browser (localStorage) only. The backup file holds the same data.
*/
import { CSVFormat, MintSummaryPeriod } from './wallet.js';

export interface SavedWallet {
  id: string;
  name: string;
  address: string;
  owner: string; // "" when not set
}

export interface Settings {
  version: 1;
  wallets: SavedWallet[];
  csvFormat: CSVFormat;
  ownerFormats: { [owner: string]: CSVFormat };
  mintSummary: MintSummaryPeriod;
}

const STORAGE_KEY = 'fluxexport-settings';
const MAX_NAME = 40;

export function defaultSettings(): Settings {
  return { version: 1, wallets: [], csvFormat: CSVFormat.CoinTracker, ownerFormats: {}, mintSummary: MintSummaryPeriod.None };
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
  if (!raw || raw.version !== 1 || !Array.isArray(raw.wallets)) throw new Error('This is not a FluxExport settings file.');

  const settings = defaultSettings();
  raw.wallets.forEach((entry: any, index: number) => {
    const address = typeof entry?.address === 'string' ? entry.address.trim() : '';
    if (!isFluxAddress(address)) throw new Error(`Wallet ${index + 1} in this file does not have a Flux address.`);
    if (settings.wallets.some(wallet => wallet.address === address)) return;
    settings.wallets.push({
      id: newId(),
      name: cleanText(entry.name) || address,
      address,
      owner: cleanText(entry.owner),
    });
  });
  if (isFormat(raw.csvFormat)) settings.csvFormat = raw.csvFormat;
  if (Object.values(MintSummaryPeriod).includes(raw.mintSummary)) settings.mintSummary = raw.mintSummary;
  if (raw.ownerFormats && typeof raw.ownerFormats === 'object') {
    for (const owner of owners(settings)) {
      const format = Object.prototype.hasOwnProperty.call(raw.ownerFormats, owner) ? raw.ownerFormats[owner] : undefined;
      if (isFormat(format)) settings.ownerFormats[owner] = format;
    }
  }
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

/** Owners with a wallet, in name order, without the blank one. */
export function owners(settings: Settings): string[] {
  return Array.from(new Set(settings.wallets.map(wallet => wallet.owner).filter(owner => owner !== ''))).sort((a, b) => a.localeCompare(b));
}

export function walletsOf(settings: Settings, owner: string): SavedWallet[] {
  return settings.wallets.filter(wallet => wallet.owner === owner).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatFor(settings: Settings, wallet: SavedWallet | null): CSVFormat {
  if (wallet && Object.prototype.hasOwnProperty.call(settings.ownerFormats, wallet.owner)) return settings.ownerFormats[wallet.owner];
  return settings.csvFormat;
}

/** Add a wallet, or change the one with this id. Returns what is wrong with it, or "". */
export function putWallet(settings: Settings, id: string, name: string, address: string, owner: string): string {
  const clean = { name: cleanText(name), address: address.trim(), owner: cleanText(owner) };
  if (!clean.name) return 'Enter a name for the wallet.';
  if (!isFluxAddress(clean.address)) return 'Enter a Flux address: t1 or t3 and 35 characters in all.';
  const same = settings.wallets.find(wallet => wallet.address === clean.address && wallet.id !== id);
  if (same) return `That address is already saved as ${same.name}.`;
  const existing = settings.wallets.find(wallet => wallet.id === id);
  if (existing) Object.assign(existing, clean);
  else settings.wallets.push({ id: newId(), ...clean });
  dropUnusedOwners(settings);
  return '';
}

export function removeWallet(settings: Settings, id: string): void {
  settings.wallets = settings.wallets.filter(wallet => wallet.id !== id);
  dropUnusedOwners(settings);
}

function dropUnusedOwners(settings: Settings): void {
  const used = owners(settings);
  Object.keys(settings.ownerFormats).forEach(owner => {
    if (!used.includes(owner)) delete settings.ownerFormats[owner];
  });
}

/** For example LLC-Mining_2026-01-01_2026-11-25.csv */
export function suggestFileName(wallet: SavedWallet | null, address: string, start: string, end: string, today: string): string {
  const slug = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let who = address ? address.slice(0, 8) : 'wallet';
  if (wallet) {
    const name = slug(wallet.name);
    const owner = slug(wallet.owner);
    const hasOwner = owner === '' || name.toLowerCase() === owner.toLowerCase() || name.toLowerCase().startsWith(`${owner.toLowerCase()}-`);
    who = (hasOwner ? name : `${owner}-${name}`) || address.slice(0, 8);
  }
  return `${slug(who)}_${start || 'all'}_${end || today}.csv`;
}
