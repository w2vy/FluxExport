// test.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  setSingle,
  setAddress,
  setCsvFormat,
  parseDateToEpoch,
  CSVFormat,
  getwallet,
} from "./wallet";

async function main(): Promise<void> {
  // Command-line argument parsing
  const argv = yargs(hideBin(process.argv))
    .option("single", {
      type: "boolean",
      description: "Enable or disable single mode",
    })
    .option("address", {
      type: "string",
      description: "Set the wallet address",
    })
    .option("csvFormat", {
      choices: [CSVFormat.CoinTracker, CSVFormat.CoinTrackerExport],
      description: "Set the CSV format",
    })
    .option("startDate", {
      type: "string",
      description: "Start date in MM/DD/YYYY format",
    })
    .option("endDate", {
      type: "string",
      description: "End date in MM/DD/YYYY format",
    })
    .demandOption(["address", "csvFormat"], "Please provide required arguments")
    .help()
    .argv;

  // Set configurations
  if (argv.single !== undefined) setSingle(argv.single);
  if (argv.address) setAddress(argv.address);
  if (argv.csvFormat) setCsvFormat(argv.csvFormat as CSVFormat);

  let startEpoch: number | null = null;
  let endEpoch: number | null = null;

  if (argv.startDate) {
    startEpoch = parseDateToEpoch(argv.startDate);
    console.log(`Start Date (epoch): ${startEpoch}`);
  }

  if (argv.endDate) {
    endEpoch = parseDateToEpoch(argv.endDate);
    console.log(`End Date (epoch): ${endEpoch}`);
  }

  console.log("Configurations:");
  console.log(`single: ${single}`);
  console.log(`Address: ${Address}`);
  console.log(`CSV Format: ${csvFormat}`);
  console.log(`Start Epoch: ${startEpoch}`);
  console.log(`End Epoch: ${endEpoch}`);

  // Call getwallet to perform wallet operations
  await getwallet();
}

main().catch((err) => {
  console.error("Error in main:", err);
});
