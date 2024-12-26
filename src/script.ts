import { getwallet, setSingle, setAddress, setCsvFormat, parseDateToEpoch, CSVFormat } from './wallet.js';

  // Function to validate the file name
function validateFileName(fileName: string): boolean {
  // Regular expression to allow only letters, numbers, underscores, hyphens, and ensure it ends with .csv
  const validFileNamePattern = /^[a-zA-Z0-9_-]+\.csv$/;
  
  return validFileNamePattern.test(fileName);
}
  
// Handle form submission
document.getElementById('walletForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const address = (document.getElementById('address') as HTMLInputElement).value;
  const csvFormat = (document.getElementById('csvFormat') as HTMLSelectElement).value;
  const startDateStr = (document.getElementById('startDate') as HTMLInputElement).value;
  const endDateStr = (document.getElementById('endDate') as HTMLInputElement).value;
  const fileNameInput = document.getElementById('filename') as HTMLInputElement;
  const fileName = fileNameInput.value.trim();

  console.log("do submit");
  // Validate address
  if (!address) {
    alert('Address is required!');
    return;
  }

  // Validate CSV format
  if (![CSVFormat.CoinTracker, CSVFormat.CoinTrackerExport].includes(csvFormat as CSVFormat)) {
    alert('Invalid CSV Format');
    return;
  }

  // Set configuration
  setAddress(address);
  setCsvFormat(csvFormat as CSVFormat);

  let startEpoch: number | null = null;
  let endEpoch: number | null = null;

  // Parse and validate start date
  if (startDateStr) {
    startEpoch = parseDateToEpoch(startDateStr);
  } else {
    startEpoch = 0;
    return;
  }

  // Parse and validate end date
  if (endDateStr) {
    endEpoch = parseDateToEpoch(endDateStr);
  } else {
    endEpoch = 0;
    return;
  }

  // Validate the file name
  if (!validateFileName(fileName)) {
    alert('Invalid file name. Please ensure the file name ends with ".csv" and contains only letters, numbers, underscores, and hyphens.');
    return;
  }
    
  // Call getwallet to get the wallet data
  const {data, rows} = await getwallet();
  
// Generate the CSV content
let csvContent: string = "";

  data.forEach((row) => {
    csvContent += row + "\n";
  });

  // Trigger CSV download
  downloadCSV(csvContent, fileName);
});

// Function to trigger CSV download
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
