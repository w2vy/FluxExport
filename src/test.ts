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
} from "./wallet.js";

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
    .option("testTxid", {
      alias: ['testTxid', 'testtxid'],
      type: "string",
      description: "Transaction ID for testing single mode",
    })
    .option("startDate", {
      alias: ['startDate', 'startdate'],
      type: "string",
      description: "Start date in MM/DD/YYYY format",
    })
    .option("endDate", {
      alias: ['endDate', 'enddate'],
      type: "string",
      description: "End date in MM/DD/YYYY format",
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
    startEpoch = parseDateToEpoch(argv.startDate, false); // First Second of the day
    console.log(`Start Date (epoch): ${startEpoch}`);
    setStartDate(startEpoch);
  }

  if (argv.endDate) {
    endEpoch = parseDateToEpoch(argv.endDate, true); // Last Second of the day
    console.log(`End Date (epoch): ${endEpoch}`);
    setEndDate(endEpoch);
  }

  if (argv.testTxid) setTestTxid(argv.testTxid);

  console.log("Configurations:");
  console.log(`single: ${argv.single}`);
  console.log(`Address: ${argv.address}`);
  console.log(`CSV Format: ${argv.csvFormat}`);
  console.log(`Start Epoch: ${startEpoch}`);
  console.log(`End Epoch: ${endEpoch}`);
  console.log(`Test Txid: ${argv.testTxid || "None"}`);

  try {
    if (argv.single) {
      console.log("Single mode enabled. Decoding a single transaction...");
      if (!argv.testTxid) {
        throw new Error("testTxid is required in single mode.");
      }
      await decodeTransaction(0, argv.testTxid, argv.address || "");
    } else {
      console.log("Fetching wallet data...");
      await getwallet();
    }
  } catch (error) {
    const err = error as Error;
    console.error("An error occurred:", err.message);
  }
}

main().catch((err) => {
  console.error("Unexpected error in main:", err);
});
