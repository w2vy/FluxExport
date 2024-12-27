import { getwallet, setSingle, setAddress, setCsvFormat, parseDateToEpoch, CSVFormat, setStartDate, setEndDate } from './wallet.js';

  // Function to validate the file name
  function validateFileName(fileName: string): boolean {
    // Regular expression to allow only letters, numbers, underscores, hyphens, and ensure it ends with .csv
    const validFileNamePattern = /^[a-zA-Z0-9_-]+\.csv$/;
    return validFileNamePattern.test(fileName);
  }
  
let cvsDownloadData:string = "";
let downloadFileName = "";

document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
    const statusMessage = document.getElementById('status') as HTMLParagraphElement;
  
    // Get elements for inputs
    const addressInput = document.getElementById('address') as HTMLInputElement;
    const csvFormatSelect = document.getElementById('csvFormat') as HTMLSelectElement;
    const startDateInput = document.getElementById('startDate') as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;
  
    // Parse the date inputs
    const startDate = startDateInput.value ? parseDateToEpoch(startDateInput.value) : null;
    const endDate = endDateInput.value ? parseDateToEpoch(endDateInput.value) : null;
  
    // Set initial configurations
    setAddress(addressInput.value);
    setCsvFormat(CSVFormat[csvFormatSelect.value as keyof typeof CSVFormat]);
  
    // Handle form submission
    document.getElementById('walletForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
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
            setStartDate(startEpoch);
        } else {
            startEpoch = 0;
        return;
        }
    
        // Parse and validate end date
        if (endDateStr) {
            endEpoch = parseDateToEpoch(endDateStr);
            setEndDate(endEpoch);
        } else {
            endEpoch = 0;
        return;
        }
    
        // Validate the file name
        if (!validateFileName(fileName)) {
            alert('Invalid file name. Please ensure the file name ends with ".csv" and contains only letters, numbers, underscores, and hyphens.');
            return;
        }
        downloadFileName = fileName;
        // Call getwallet and enable download button on success
        getwallet(updateStatusMessage).then(({data, rows}) => {
            // Save the download data
            data.forEach(row => { cvsDownloadData = cvsDownloadData + row + '\n'; });
            // Once getwallet is done, enable the download button
            downloadBtn.disabled = false;
        
            // Update the status message when getwallet is complete
            updateStatusMessage('Ready for download'); // You might want to call this after actual processing logic
        }).catch((error) => {
            console.error('Error while fetching wallet:', error);
        });
        
    });
  
    // Handle the download click event
    downloadBtn.addEventListener('click', () => {
      // Call your function to download CSV here
      downloadCSV();
    });
  });
  
  // Function to update the status message
  function updateStatusMessage(message: string) {
    const statusMessage = document.getElementById('status') as HTMLParagraphElement;
    statusMessage.textContent = message;
  }
  
// Example CSV Download function
function downloadCSV() {
    // Assume you have CSV data available from your wallet processing logic
    const csvData = cvsDownloadData; // This should be the CSV data from scanWallet
    const blob = new Blob([csvData], { type: 'text/csv' });
    cvsDownloadData = "";
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = downloadFileName;
    link.click();
  }
  