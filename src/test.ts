// test.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  setSingle,
  setAddress,
  setTestTxid,
  setCsvFormat,
  setStartDate,
  setEndDate,
  parseDateToEpoch,
  CSVFormat,
  getwallet,
  decodeTransaction,
  fetchTransaction
} from "./wallet.js";

  // Function to update the status message
  function updateStatusMessage(message: string) {
    console.log(`${message}`);
  }

// Function to validate the file name
function validateFileName(fileName: string): boolean {
  // Regular expression to allow only letters, numbers, underscores, hyphens, and ensure it ends with .csv
  const validFileNamePattern = /^[a-zA-Z0-9_-]+\.csv$/;
  
  return validFileNamePattern.test(fileName);
}

async function main(): Promise<void> {
  // Command-line argument parsing
  const argv = await yargs(hideBin(process.argv))
    .option("single", {
      type: "boolean",
      description: "Enable or disable single mode",
      default: false,
    })
    .option("address", {
      type: "string",
      description: "Set the wallet address",
    })
    .option("csvFormat", {
      alias: ['csvFormat', 'csvformat'],
      choices: [CSVFormat.CoinTracker, CSVFormat.CoinTrackerExport],
      description: "Set the CSV format",
      default: CSVFormat.CoinTracker,
    })
    .option("txid", {
      type: "string",
      description: "Transaction ID for testing single mode",
    })
    .option("startDate", {
      alias: ['startDate', 'startdate'],
      type: "string",
      description: "Start date in YYYY-MM-DD format",
    })
    .option("endDate", {
      alias: ['endDate', 'enddate'],
      type: "string",
      description: "End date in YYYY-MM-DD format",
    })
    .demandOption(["address"], "Please provide required arguments")
    .help()
    .argv;

  // Set configurations
  setSingle(argv.single);
  if (argv.address) setAddress(argv.address);
  if (argv.csvFormat) setCsvFormat(argv.csvFormat as CSVFormat);

  let startEpoch: number | null = null;
  let endEpoch: number | null = null;

  console.log(argv.startDate);
  if (argv.startDate) {
    startEpoch = parseDateToEpoch(argv.startDate);
    console.log(`Start Date (epoch): ${startEpoch}`);
    setStartDate(startEpoch);
  }

  if (argv.endDate) {
    endEpoch = parseDateToEpoch(argv.endDate);
    console.log(`End Date (epoch): ${endEpoch}`);
    setEndDate(endEpoch);
  }

  if (argv.txid) setTestTxid(argv.txid);

  console.log("Configurations:");
  console.log(`single: ${argv.single}`);
  console.log(`Address: ${argv.address}`);
  console.log(`CSV Format: ${argv.csvFormat}`);
  console.log(`Start Epoch: ${startEpoch}`);
  console.log(`End Epoch: ${endEpoch}`);
  console.log(`Test Txid: ${argv.txid || "None"}`);

  try {
    if (argv.single) {
      console.log("Single mode enabled. Decoding a single transaction...");
      if (!argv.txid) {
        throw new Error("test Txid is required in single mode.");
      }
      let txn = await fetchTransaction(argv.txid);
      await decodeTransaction(txn, argv.address || "");
    } else {
      console.log("Fetching wallet data...");
      // Call getwallet and enable download button on success
      getwallet(updateStatusMessage).then(({data, rows}) => {
          // Save the download data
          data.forEach(row => { console.log(row); });
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error("An error occurred:", err.message);
  }
}

main().catch((err) => {
  console.error("Unexpected error in main:", err);
});
