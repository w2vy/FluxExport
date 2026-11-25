import { getwallet, setAddress, setOwnAddresses, setCsvFormat, parseDateToEpoch, CSVFormat, setStartDate, setEndDate, setMintSummary, MintSummaryPeriod, clearCaches, getCacheStats } from './wallet.js';
import { Settings, SavedAddress, loadSettings, saveSettings, settingsText, parseSettings, walletNames, addressesOf, formatFor, usesKoinly, putAddress, removeAddress, renameWallet, setDefaultFormat, setWalletFormat, companies, setWalletCompany, ownAddressesOf, isFluxAddress, suggestFileName } from './config.js';

const OTHER_ADDRESS = 'other';
const ALL_ADDRESSES = 'all';
const DAY_IN_SECONDS = 24 * 60 * 60;

function validateFileName(fileName: string): boolean {
  // Letters, numbers, underscores, hyphens, ending with .csv
  return /^[a-zA-Z0-9_-]+\.csv$/.test(fileName);
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function addOption(parent: HTMLElement, value: string, text: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  parent.appendChild(option);
}

function saveFile(text: string, type: string, fileName: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type }));
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC
}

document.addEventListener('DOMContentLoaded', () => {
  let settings: Settings = loadSettings();
  let files: { name: string; text: string }[] = []; // ready to download
  let fileNameEdited = false;
  let editingId = '';
  let scanning = false;

  // Export Transactions
  const exportFields = byId<HTMLFieldSetElement>('exportFields');
  const walletRow = byId<HTMLElement>('walletRow');
  const walletSelect = byId<HTMLSelectElement>('walletSelect');
  const addressRow = byId<HTMLElement>('addressRow');
  const addressInput = byId<HTMLInputElement>('address');
  const formatLine = byId<HTMLElement>('formatLine');
  const startDateInput = byId<HTMLInputElement>('startDate');
  const endDateInput = byId<HTMLInputElement>('endDate');
  const yearButtons = byId<HTMLElement>('yearButtons');
  const fileNameRow = byId<HTMLElement>('fileNameRow');
  const fileList = byId<HTMLElement>('fileList');
  const fileNameInput = byId<HTMLInputElement>('filename');
  const status = byId<HTMLParagraphElement>('status');
  const downloadBtn = byId<HTMLButtonElement>('downloadBtn');
  const downloadNotice = byId<HTMLParagraphElement>('downloadNotice');
  const clearCacheBtn = byId<HTMLButtonElement>('clearCacheBtn');
  const cacheInfo = byId<HTMLParagraphElement>('cacheInfo');

  // Configuration
  const configFields = byId<HTMLFieldSetElement>('configFields');
  const walletList = byId<HTMLElement>('walletList');
  const walletEditForm = byId<HTMLFormElement>('walletEditForm');
  const walletName = byId<HTMLInputElement>('walletName');
  const walletAddress = byId<HTMLInputElement>('walletAddress');
  const walletGroup = byId<HTMLInputElement>('walletGroup');
  const walletGroups = byId<HTMLDataListElement>('walletGroups');
  const companyNames = byId<HTMLDataListElement>('companyNames');
  const walletSaveBtn = byId<HTMLButtonElement>('walletSaveBtn');
  const walletCancelBtn = byId<HTMLButtonElement>('walletCancelBtn');
  const csvFormatSelect = byId<HTMLSelectElement>('csvFormat');
  const mintSummarySelect = byId<HTMLSelectElement>('mintSummary');
  const backupSaveBtn = byId<HTMLButtonElement>('backupSaveBtn');
  const backupLoadBtn = byId<HTMLButtonElement>('backupLoadBtn');
  const backupFile = byId<HTMLInputElement>('backupFile');
  const configStatus = byId<HTMLParagraphElement>('configStatus');

  const updateStatusMessage = (message: string) => { status.textContent = message; };

  // ---- Tabs ----

  const setUpTabs = (root: HTMLElement, key: 'panel' | 'format', onSelect?: (value: string) => void) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('.tab-panel'));
    const select = (value: string) => {
      tabs.forEach(tab => {
        const isActive = tab.dataset[key] === value;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      panels.forEach(panel => {
        const isActive = panel.dataset[key] === value;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
      });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        const value = tab.dataset[key];
        if (!value) return;
        select(value);
        onSelect?.(value);
      });
      tab.addEventListener('keydown', event => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step === 0) return;
        const next = tabs[(index + step + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });
    return select;
  };

  const showMainTab = setUpTabs(byId('mainTabs'), 'panel');
  const showTips = setUpTabs(byId('formatTips'), 'format'); // help only, does not change the format

  // ---- Export Transactions ----

  const selectedWallet = (): SavedAddress | null => settings.addresses.find(saved => saved.id === walletSelect.value) ?? null;

  const selectedAddress = (): string => selectedWallet()?.address ?? addressInput.value.trim();

  const clearDownload = (message: string) => {
    files = [];
    fileList.textContent = '';
    downloadBtn.textContent = 'Download CSV';
    downloadBtn.disabled = true;
    downloadBtn.setAttribute('aria-disabled', 'true');
    downloadNotice.textContent = message;
  };

  const enableDownload = () => {
    downloadBtn.disabled = false;
    downloadBtn.setAttribute('aria-disabled', 'false');
    downloadBtn.textContent = files.length > 1 ? `Download ${files.length} CSVs` : 'Download CSV';
    downloadNotice.textContent = files.length > 1
      ? 'Download ready. Your browser may ask to allow more than one file.'
      : 'Download ready. Click the button to save your CSV.';
  };

  // The export on hand no longer matches the inputs
  const inputsChanged = () => {
    if (files.length === 0 && !fileList.hasChildNodes()) return;
    clearDownload('Inputs changed. Run "Get Wallet" again to enable the download.');
    updateStatusMessage('Inputs changed. Run "Get Wallet" to refresh.');
  };

  const refreshFileName = () => {
    if (fileNameEdited) return;
    fileNameInput.value = suggestFileName(selectedWallet(), selectedAddress(), startDateInput.value, endDateInput.value, today());
  };

  const refreshExport = () => {
    const wallet = selectedWallet();
    const isAll = walletSelect.value === ALL_ADDRESSES;
    const isOther = wallet === null && !isAll;
    fileNameRow.hidden = isAll;
    addressRow.hidden = !isOther;
    addressInput.required = isOther;

    if (isAll) {
      formatLine.textContent = 'One CSV for each saved address, in the format of its wallet.';
      showTips(settings.csvFormat);
      return;
    }
    const format = formatFor(settings, wallet);
    const parts = [`CSV format: ${format}`];
    if (format === CSVFormat.Koinly) parts.push(`Mining summary: ${settings.mintSummary}`);
    formatLine.textContent = parts.join(' · ');
    showTips(format);
    refreshFileName();
  };

  const renderWalletSelect = () => {
    const previous = walletSelect.value;
    walletSelect.textContent = '';
    walletNames(settings).forEach(wallet => {
      const group = document.createElement('optgroup');
      group.label = wallet;
      addressesOf(settings, wallet).forEach(saved => addOption(group, saved.id, saved.name));
      walletSelect.appendChild(group);
    });
    if (settings.addresses.length > 1) addOption(walletSelect, ALL_ADDRESSES, `All addresses (${settings.addresses.length})`);
    addOption(walletSelect, OTHER_ADDRESS, 'Other address…');
    walletRow.hidden = settings.addresses.length === 0;
    if (settings.addresses.length === 0) walletSelect.value = OTHER_ADDRESS;
    else if (Array.from(walletSelect.options).some(option => option.value === previous) && previous !== OTHER_ADDRESS) walletSelect.value = previous;
    else walletSelect.selectedIndex = 0;
  };

  const renderYearButtons = () => {
    const year = Number(today().slice(0, 4));
    const ranges: [string, string, string][] = [
      [String(year - 1), `${year - 1}-01-01`, `${year - 1}-12-31`],
      [String(year), `${year}-01-01`, today()],
      ['All dates', '', ''],
    ];
    ranges.forEach(([label, start, end]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'small-btn';
      button.textContent = label;
      button.addEventListener('click', () => {
        startDateInput.value = start;
        endDateInput.value = end;
        inputsChanged();
        refreshFileName();
      });
      yearButtons.appendChild(button);
    });
  };

  const updateCacheInfo = async () => {
    const { txCount, approxBytes } = await getCacheStats();
    cacheInfo.textContent = `Cache: ${txCount} transactions (~${(approxBytes / 1024).toFixed(1)} KB)`;
  };

  // Nothing can change while a wallet is being read, so the file matches what is on the screen
  const setScanning = (value: boolean) => {
    scanning = value;
    exportFields.disabled = value;
    configFields.disabled = value;
    clearCacheBtn.disabled = value;
  };

  walletSelect.addEventListener('change', () => { inputsChanged(); refreshExport(); });
  addressInput.addEventListener('input', () => { inputsChanged(); refreshFileName(); });
  [startDateInput, endDateInput].forEach(input => input.addEventListener('input', () => { inputsChanged(); refreshFileName(); }));
  fileNameInput.addEventListener('input', () => { fileNameEdited = fileNameInput.value.trim() !== ''; });
  fileNameInput.addEventListener('blur', refreshFileName);

  clearCacheBtn.addEventListener('click', async () => {
    await clearCaches();
    updateStatusMessage('Cache cleared.');
    clearDownload('Cache cleared. Run "Get Wallet" again.');
    updateCacheInfo();
  });

  const readAddress = (address: string, saved: SavedAddress | null, start: string, end: string, onStatus: (message: string) => void) => {
    const format = formatFor(settings, saved);
    setAddress(address);
    setOwnAddresses(ownAddressesOf(settings, address));
    setCsvFormat(format);
    setMintSummary(format === CSVFormat.Koinly ? settings.mintSummary : MintSummaryPeriod.None);
    setStartDate(start ? parseDateToEpoch(start) : 0);
    setEndDate(end ? parseDateToEpoch(end) + DAY_IN_SECONDS - 1 : 0); // the whole end day
    return getwallet(onStatus);
  };

  const csvText = (data: string[]): string => data.map(row => row + '\n').join('');

  const errorText = (error: unknown): string => error instanceof Error ? error.message : 'Unable to read this wallet. Nothing was exported.';

  const exportOne = async (address: string, start: string, end: string) => {
    try {
      const { data, rows } = await readAddress(address, selectedWallet(), start, end, updateStatusMessage);
      if (rows > 1) {
        files = [{ name: '', text: csvText(data) }]; // saved under the name in the form
        enableDownload();
        updateStatusMessage(`Ready for download: ${rows - 1} rows`);
      } else {
        clearDownload('No transactions available for the selected filters.');
        updateStatusMessage('No transactions found for this address or date range.');
      }
    } catch (error) {
      console.error('Error while fetching wallet:', error);
      clearDownload('Export failed, no file to download.');
      updateStatusMessage(errorText(error));
    }
  };

  const smallButton = (text: string, label: string, onClick: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'small-btn';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', onClick);
    return button;
  };

  const addFileLine = (text: string, file?: { name: string; text: string }) => {
    const row = document.createElement('div');
    row.className = 'wallet-row';
    const label = document.createElement('div');
    label.className = 'wallet-text';
    label.textContent = text;
    row.append(label);
    if (file) row.append(smallButton('Save', `Save ${file.name}`, () => saveFile(file.text, 'text/csv', file.name)));
    fileList.appendChild(row);
  };

  const exportAll = async (start: string, end: string) => {
    const all = walletNames(settings).flatMap(wallet => addressesOf(settings, wallet));
    const taken = new Set<string>();
    let failed = 0;
    for (let index = 0; index < all.length; index++) {
      const saved = all[index];
      const title = `${saved.wallet}: ${saved.name}`;
      const progress = (message: string) => updateStatusMessage(`${index + 1} of ${all.length}, ${title}. ${message}`);
      progress('Reading the wallet...');
      try {
        const { data, rows } = await readAddress(saved.address, saved, start, end, progress);
        if (rows <= 1) {
          addFileLine(`${title}: no transactions`);
          continue;
        }
        const wanted = suggestFileName(saved, saved.address, start, end, today());
        let name = wanted;
        for (let copy = 2; taken.has(name.toLowerCase()); copy++) name = wanted.replace(/\.csv$/, `-${copy}.csv`);
        taken.add(name.toLowerCase());
        const file = { name, text: csvText(data) };
        files.push(file);
        addFileLine(`${title}: ${rows - 1} rows`, file);
      } catch (error) {
        console.error('Error while fetching wallet:', error);
        failed++;
        addFileLine(`${title}: FAILED. ${errorText(error)}`);
      }
    }
    const problem = failed > 0 ? ` ${failed} of ${all.length} addresses failed, see the list.` : '';
    if (files.length > 0) enableDownload();
    else downloadNotice.textContent = 'No file to download.';
    updateStatusMessage(files.length > 0 ? `Ready for download: ${files.length} ${files.length === 1 ? 'file' : 'files'}.${problem}` : `No transactions found.${problem}`);
  };

  byId('walletForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (scanning) return;
    const isAll = walletSelect.value === ALL_ADDRESSES;
    const address = selectedAddress();
    const start = startDateInput.value;
    const end = endDateInput.value;

    clearDownload('');
    if (!isAll && !isFluxAddress(address)) {
      updateStatusMessage('Enter a Flux address: t1 or t3 and 35 characters in all.');
      return;
    }
    if (start && end && start > end) {
      updateStatusMessage('The start date is after the end date.');
      return;
    }
    refreshFileName();
    if (!isAll && !validateFileName(fileNameInput.value.trim())) {
      updateStatusMessage('The file name must end with .csv and use only letters, numbers, underscores and hyphens.');
      return;
    }

    setScanning(true);
    updateStatusMessage('Reading the wallet...');
    try {
      if (isAll) await exportAll(start, end);
      else await exportOne(address, start, end);
    } finally {
      setScanning(false);
      updateCacheInfo();
    }
  });

  downloadBtn.addEventListener('click', async () => {
    if (files.length === 0) return;
    if (walletSelect.value === ALL_ADDRESSES) {
      const count = files.length;
      for (const file of files.slice()) {
        saveFile(file.text, 'text/csv', file.name);
        await new Promise(resolve => setTimeout(resolve, 300)); // browsers drop downloads started together
      }
      downloadNotice.textContent = `Saved ${count} ${count === 1 ? 'file' : 'files'}. Use Save in the list for one that is missing.`;
      return;
    }
    const fileName = fileNameInput.value.trim();
    if (!validateFileName(fileName)) {
      downloadNotice.textContent = 'The file name must end with .csv and use only letters, numbers, underscores and hyphens.';
      return;
    }
    downloadNotice.textContent = `Saved as ${fileName}. Click the button to save it again.`;
    saveFile(files[0].text, 'text/csv', fileName);
  });

  // ---- Configuration ----

  const refreshAll = () => {
    renderWalletSelect();
    renderConfig();
    refreshExport();
  };

  const storeSettings = (message: string) => {
    const saved = saveSettings(settings);
    configStatus.textContent = saved ? message : 'This browser did not save the settings. Use "Save backup" to keep them.';
    inputsChanged();
  };

  const settingsChanged = (message: string) => {
    storeSettings(message);
    refreshAll();
  };

  // The wallet stays filled in, to add its next address
  const stopEditing = () => {
    editingId = '';
    walletName.value = '';
    walletAddress.value = '';
    walletSaveBtn.textContent = 'Add address';
    walletCancelBtn.hidden = true;
  };

  const addressRowFor = (saved: SavedAddress): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'wallet-row';
    const text = document.createElement('div');
    text.className = 'wallet-text';
    const title = document.createElement('strong');
    title.textContent = saved.name;
    const address = document.createElement('span');
    address.textContent = saved.address;
    text.append(title, address);
    row.append(
      text,
      smallButton('Edit', `Edit ${saved.wallet}: ${saved.name}`, () => {
        editingId = saved.id;
        walletGroup.value = saved.wallet;
        walletName.value = saved.name;
        walletAddress.value = saved.address;
        walletSaveBtn.textContent = 'Save address';
        walletCancelBtn.hidden = false;
        walletName.focus();
      }),
      smallButton('Delete', `Delete ${saved.wallet}: ${saved.name}`, () => {
        if (!confirm(`Delete ${saved.name} from ${saved.wallet}?`)) return;
        if (editingId === saved.id) stopEditing();
        removeAddress(settings, saved.id);
        settingsChanged(`${saved.name} deleted.`);
      }),
    );
    return row;
  };

  const walletFormatFor = (wallet: string, id: string): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'wallet-format';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = 'CSV Format:';
    const select = document.createElement('select');
    select.id = id;
    select.setAttribute('aria-label', `CSV Format for ${wallet}`);
    addOption(select, '', `Default (${settings.csvFormat})`);
    [CSVFormat.CoinLedger, CSVFormat.Koinly, CSVFormat.CoinTracker].forEach(format => addOption(select, format, format));
    select.value = settings.walletFormats[wallet] ?? '';
    select.addEventListener('change', () => {
      setWalletFormat(settings, wallet, select.value as CSVFormat | '');
      settingsChanged(`${wallet} format saved.`);
    });
    row.append(label, select);
    return row;
  };

  const renderCompanyNames = () => {
    companyNames.textContent = '';
    companies(settings).forEach(company => addOption(companyNames, company, company));
  };

  const walletCompanyFor = (wallet: string, id: string): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'wallet-format';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = 'Company:';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.maxLength = 40;
    input.setAttribute('list', 'companyNames');
    input.placeholder = 'Company or person';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `Company or person ${wallet} belongs to`);
    input.value = settings.walletCompanies[wallet] ?? '';
    input.addEventListener('change', () => {
      // The list is not drawn again here: the click that left this field may be on one of its buttons
      input.value = setWalletCompany(settings, wallet, input.value);
      storeSettings(`${wallet} company saved.`);
      renderCompanyNames();
    });
    row.append(label, input);
    return row;
  };

  const renderConfig = () => {
    const names = walletNames(settings);
    walletList.textContent = '';
    if (names.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No wallets saved yet.';
      walletList.appendChild(empty);
    }
    names.forEach((wallet, index) => {
      const group = document.createElement('section');
      group.className = 'wallet-group';
      const heading = document.createElement('div');
      heading.className = 'wallet-heading';
      const title = document.createElement('h4');
      title.textContent = wallet;
      heading.append(
        title,
        smallButton('Rename', `Rename ${wallet}`, () => {
          const newName = prompt('New name for this wallet:', wallet);
          if (newName === null) return;
          const problem = renameWallet(settings, wallet, newName);
          if (problem) {
            configStatus.textContent = problem;
            return;
          }
          if (walletGroup.value === wallet) walletGroup.value = newName.trim();
          settingsChanged('Wallet renamed.');
        }),
        smallButton('Add address', `Add an address to ${wallet}`, () => {
          stopEditing();
          walletGroup.value = wallet;
          walletName.focus();
        }),
      );
      group.append(heading, walletCompanyFor(wallet, `walletCompany${index}`), walletFormatFor(wallet, `walletFormat${index}`), ...addressesOf(settings, wallet).map(addressRowFor));
      walletList.appendChild(group);
    });

    walletGroups.textContent = '';
    names.forEach(wallet => addOption(walletGroups, wallet, wallet));

    renderCompanyNames();

    csvFormatSelect.value = settings.csvFormat;
    mintSummarySelect.value = settings.mintSummary;
    mintSummarySelect.disabled = !usesKoinly(settings);
  };

  walletEditForm.addEventListener('submit', event => {
    event.preventDefault();
    const problem = putAddress(settings, editingId, walletGroup.value, walletName.value, walletAddress.value);
    if (problem) {
      configStatus.textContent = problem;
      return;
    }
    const name = walletName.value.trim();
    stopEditing();
    settingsChanged(`${name} saved.`);
    walletName.focus();
  });

  walletCancelBtn.addEventListener('click', () => {
    stopEditing();
    configStatus.textContent = '';
  });

  csvFormatSelect.addEventListener('change', () => {
    setDefaultFormat(settings, csvFormatSelect.value as CSVFormat);
    settingsChanged('CSV format saved.');
  });

  mintSummarySelect.addEventListener('change', () => {
    settings.mintSummary = mintSummarySelect.value as MintSummaryPeriod;
    settingsChanged('Mining summary saved.');
  });

  backupSaveBtn.addEventListener('click', () => {
    saveFile(settingsText(settings), 'application/json', `fluxexport-settings_${today()}.json`);
    configStatus.textContent = 'Backup saved.';
  });

  backupLoadBtn.addEventListener('click', () => backupFile.click());

  backupFile.addEventListener('change', async () => {
    const file = backupFile.files?.[0];
    if (!file) return;
    try {
      const loaded = parseSettings(await file.text());
      if (settings.addresses.length > 0 && !confirm(`Replace your ${settings.addresses.length} saved addresses and settings with this backup?`)) return;
      settings = loaded;
      stopEditing();
      settingsChanged(`Backup loaded: ${settings.addresses.length} addresses.`);
    } catch (error) {
      configStatus.textContent = error instanceof Error ? error.message : 'This is not a FluxExport settings file.';
    } finally {
      backupFile.value = ''; // the same file can be chosen again
    }
  });

  // ---- Demo images ----

  const lightbox = document.createElement('div');
  lightbox.className = 'image-lightbox';
  const lightboxImg = document.createElement('img');
  lightbox.appendChild(lightboxImg);
  let lightboxActive = false;

  const closeLightbox = () => {
    if (!lightboxActive) return;
    lightbox.classList.remove('visible');
    setTimeout(() => {
      if (lightbox.parentElement) lightbox.parentElement.removeChild(lightbox);
    }, 140);
    lightboxActive = false;
    document.removeEventListener('keydown', handleEscape);
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeLightbox();
  };

  lightbox.addEventListener('click', closeLightbox);

  const openLightbox = (src: string, alt?: string) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt ?? '';
    if (!lightbox.parentElement) document.body.appendChild(lightbox);
    requestAnimationFrame(() => lightbox.classList.add('visible'));
    lightboxActive = true;
    document.addEventListener('keydown', handleEscape);
  };

  Array.from(document.querySelectorAll<HTMLAnchorElement>('.demo-steps a')).forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const img = link.querySelector('img');
      const src = link.getAttribute('href') || img?.src;
      if (!src) return;
      openLightbox(src, img?.alt ?? '');
    });
  });

  // ---- Start ----

  renderYearButtons();
  clearDownload('');
  refreshAll();
  showMainTab('export');
  updateCacheInfo();
});
