interface Txid {
  txid: string;
}

interface WalletResponse {
  status: string;
  data: Txid[];
}

interface Vin {
  coinbase?: string;
  txid: string;
  vout: number;
  scriptSig: {
    asm: string;
    hex: string;
  };
  value: number;
  valueSat: number;
  address: string;
  sequence: number;
}

interface Vout {
  value: number;
  valueZat: number;
  valueSat: number;
  n: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: string[];
  };
}

interface Txn {
  status: string;
  data: {
    hex: string;
    txid: string;
    version: number;
    overwintered: boolean;
    versiongroupid: string;
    locktime: number;
    expiryheight: number;
    vin: Vin[];
    vout: Vout[];
    vJoinSplit: any[];
    valueBalance: number;
    valueBalanceZat: number;
    vShieldedSpend: any[];
    vShieldedOutput: any[];
    blockhash: string;
    height: number;
    confirmations: number;
    time: number;
    blocktime: number;
  };
}

interface vsum {
  [key: string]: number;
}

// wallet.ts

export enum CSVFormat {
  CoinTracker = "CoinTracker",
  CoinTrackerExport = "CoinTrackerExport",
}

export let single: boolean = false;
export let Address: string = "";
export let csvFormat: CSVFormat = CSVFormat.CoinTracker;
export let testTxid: string = "";
export let startDate: number = 0;
export let endDate: number = 0;

// Setter functions
export function setSingle(value: boolean): void {
  single = value;
}

export function setAddress(value: string): void {
  Address = value;
}

export function setTestTxid(value: string): void {
  testTxid = value;
}

export function setCsvFormat(value: CSVFormat): void {
  csvFormat = value;
}

export function setStartDate(value: number): void {
  startDate = value;
}

export function setEndDate(value: number): void {
  endDate = value;
}

// Utility to format date and time to epoch time
export function parseDateToEpoch(dateTimeStr: string): number {
  // Split date and time components
  const [datePart, timePart] = dateTimeStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  // Default time to midnight if not provided
  let hours = 0,
    minutes = 0;
  if (timePart) {
    [hours, minutes] = timePart.split(":").map(Number);
  }
  // Create the date object
  const date = new Date(year, month - 1, day, hours, minutes);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date or time format: ${dateTimeStr}`);
  }
  return Math.floor(date.getTime() / 1000);
}


// Existing functions from wallet.ts
export function formatTimestamp(epochTime: number, usa: boolean): string {
  const date = new Date(epochTime * 1000);
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Combine components into the desired format
  if (usa) return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function trimZeros(input: string): string {
  return input.replace(/\.?0+$/, "");
}

export async function getwallet(updateStatus: (message: string) => void): Promise<{ data: string[], rows: number }> {
  console.log("Starting wallet operation...");

  if (single) {
    // Perform wallet operations here
    // Example: Decoding a transaction
    try {
      let txn = await fetchTransaction(testTxid);
      await decodeTransaction(txn, Address);
    } catch (error) {
      console.error("Error during wallet operation:", error);
    }
  } else {
    const url = "https://api.runonflux.io/explorer/transactions/" + Address;
    const responseData = await fetchWebPageData(url);
    // A block range or time filter could be useful for very large (with age) wallets
  
    updateStatus("Scanning Wallet...");
    if (responseData) {
      console.log(`getwallet: Start ${startDate} End ${endDate}`);
      const { data, rows } = await scanWalletData(updateStatus, responseData, Address);
      if (rows == 0 && data.length == 1) updateStatus(data[0]);
      else updateStatus(`Wallet Scan complete, ${rows} transactions found`);
      return { data, rows };
    } else {
      console.log("Failed to retrieve data.");
    }
  }
  const data: string[]= ["Failed to retrieve data."];
  const rows:number = 0;
  return {data, rows}
}

async function fetchWebPageData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch data from ${url}: ${response.status} - ${response.statusText}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error("Error fetching the web page data:", error);
    return null;
  }
}

function isValidTxid(txid: string): boolean {
  // Define the length for the valid hex string
  const requiredLength = 64;

  // Regular expression to check if the string is hexadecimal
  const hexRegex = /^[a-fA-F0-9]+$/;

  // Validate length and pattern
  return txid.length === requiredLength && hexRegex.test(txid);
}

function send_csv_ct(
  dateTime: number, recv_qty: string | number, recv_coin: string, send_qty: any, send_coin: string, gas_fee: string | number,
  gas_coin: string, tag: string
): string {
  const date:string = formatTimestamp(dateTime, true);
  if (typeof recv_qty === "number" && recv_qty > 0) recv_qty = trimZeros((recv_qty/100000000).toFixed(8));
  if (typeof send_qty === "number" && send_qty > 0) send_qty = trimZeros((send_qty/100000000).toFixed(8));
  if (typeof gas_fee === "number" && gas_fee > 0) gas_fee = trimZeros((gas_fee/100000000).toFixed(8));
  const csvRow = [
    date, recv_qty, recv_coin, send_qty, send_coin, gas_fee, gas_coin, tag
  ].join(",");
  return csvRow;
}

function send_csv_ctExport(
  dateTime: number, type: string, txid: string, recv_qty: string | number, recv_coin: string, recv_usd: number | string, recv_name: string, recv_adr: string,
  recv_comment: string, send_qty: any, send_coin: string, send_usd: any, send_name: string, send_adr: string, send_comment: string, gas_fee: any,
  gas_coin: string, gas_usd: any
): string {
  const date:string = formatTimestamp(dateTime, false);
  if (typeof recv_usd === "number" && recv_usd as number > 0 && recv_usd as number < 0.0001) recv_usd = 0;
  if (typeof send_usd === "number" && send_usd as number > 0 && send_usd as number < 0.0001) send_usd = 0;
  if (typeof gas_usd === "number" && gas_usd as number > 0 && gas_usd as number < 0.0001) gas_usd = 0;
  if (typeof recv_qty === "number" && recv_qty > 0) recv_qty = trimZeros((recv_qty/100000000).toFixed(8));
  if (typeof send_qty === "number" && send_qty > 0) send_qty = trimZeros((send_qty/100000000).toFixed(8));
  if (typeof gas_fee === "number" && gas_fee > 0) gas_fee = trimZeros((gas_fee/100000000).toFixed(8));
  const csvRow = [
    date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
    send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd
  ].join(",");
  return csvRow;
}

export async function fetchTransaction(txid: string): Promise<Txn> {
  const url = 'https://api.runonflux.io/daemon/getrawtransaction?verbose=1&txid=' + txid;
  if (!isValidTxid(txid)) console.log(`fetchTransaction: bad txid len ${txid.length} ${txid}`);
  else {
    for (let i = 1; i <= 3; i++) {
      const responseData = await fetchWebPageData(url);

      if (!responseData) {
        console.log("Failed to retrieve data.");
        await sleep(500);
        continue;
      }
      var txn = JSON.parse(responseData) as Txn;
      if (!txn || !txn.data) {
        console.log(responseData);
        console.error("Invalid Txn structure.");
        await sleep(500);
        continue;
      }
      return txn;
    }
  }
  throw new Error(`Unable to fetchTransaction for ${txid}`);
}

export async function decodeTransaction(txn: Txn, myAddress:string): Promise<string[] | null> {
  let data: string[] | null = [];
  var mined: boolean = false;
  var hasVin: boolean = false;
  var hasVout: boolean = false;
  var voutValue: number = 0;
  var vinValue: number = 0;
  var voutTotal: number = 0;
  var vinTotal: number = 0;
  var vinAddress: string|undefined = undefined;
  var voutAddress: string|undefined = undefined;
  var vinsum: vsum = {};
  var voutList: vsum = {};
  var display:boolean = true;
  var skip:boolean = false;
  var voutAllMe: boolean = true;
  const dateTime: number = txn.data.time;
  const txid: string = txn.data.txid

  if (txn.data.vin !== undefined) {
    txn.data.vin.forEach(vin => {
      if (vin.address === undefined) mined = true;
      else {
        if (vin.address === myAddress) hasVin = true;
        if (vinsum[vin.address] === undefined) vinsum[vin.address] = vin.valueSat;
        else vinsum[vin.address] = vinsum[vin.address] + vin.valueSat;
        vinTotal = vinTotal + vin.valueSat;
      }
    });
  }
  if (txn.data.vout !== undefined) {
      txn.data.vout.forEach(vout => {
        if (vout.scriptPubKey.addresses !== undefined) {
          vout.scriptPubKey.addresses.forEach(outAdr => {
            if (outAdr === myAddress) hasVout = true;
            else voutAllMe = false;
            if (voutList[outAdr] === undefined) voutList[outAdr] = vout.valueSat;
            else voutList[outAdr] = voutList[outAdr] + vout.valueSat;
            voutTotal = voutTotal + vout.valueSat;
          });
        }
    });
  }
  //console.log(`Time is ${txn.data.time}`);
  var coin_value:number = 0.75;
  var msg: string = "";
  var type: string = "";
  var recv_qty : string | number = "";
  var recv_coin: string = "";
  var recv_usd : string | number = "";
  var recv_name: string = "";
  var recv_adr: string = "";
  var recv_comment: string = "";
  var send_qty : string | number = "";
  var send_coin: string = "";
  var send_usd: string | number = "";
  var send_name: string = "";
  var send_adr: string = "";
  var send_comment: string = "";
  var gas_fee: string | number = (vinTotal || 0) - (voutTotal || 0);
  var gas_coin: string = "";
  var gas_usd: number = 0;

  if (single) {
    console.log(`vin sum`);console.log(vinsum);
    console.log(`vout List`);console.log(voutList);
    console.log(`has vin ${hasVin} out ${hasVout} All Me ${voutAllMe} Gas ${gas_fee}`)
  }

  if (hasVin && hasVout && voutAllMe) { // Sent to self (same wallet)
    type = "SENT";
    send_qty = 0;
    send_coin = "FLUX";
    send_usd = "0";
    send_adr = myAddress;
    recv_adr = myAddress;
    gas_coin = "FLUX";
    gas_usd = gas_fee*coin_value/100000000;
    if (gas_fee > 0) { // if qty and gas 0, nothing to see here
      if (csvFormat === CSVFormat.CoinTrackerExport) {
        data.push(send_csv_ctExport(dateTime, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
          send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd));
      }
      if (csvFormat === CSVFormat.CoinTracker) {
        data.push(send_csv_ct(dateTime, recv_qty, recv_coin, send_qty, send_coin, gas_fee, gas_coin, ""));
      }
    }
  } else if (mined) {
    type = "MINED";
    recv_qty = voutList[myAddress];
    recv_coin = "FLUX";
    recv_usd = recv_qty*coin_value/100000000;
    gas_fee = 0;
    gas_usd = 0;
    //console.log(`Mined ${date}`);
    if (csvFormat === CSVFormat.CoinTrackerExport) {
      data.push(send_csv_ctExport(dateTime, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
        send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd));
    }
    if (csvFormat === CSVFormat.CoinTracker) {
      data.push(send_csv_ct(dateTime, recv_qty, recv_coin, send_qty, send_coin, gas_fee, gas_coin, "mining"));
    }
  } else { // 
    if (Object.keys(vinsum).length == 1) {
      send_adr = Object.keys(vinsum)[0];
    } else {
      send_adr = "multiAddress send";
      msg = `From Addresses: ${Object.keys(vinsum).join(", ")}`;
    }
    if (hasVin) {
      type = "SENT";
      Object.keys(voutList).forEach(outAdr => {
        if (outAdr !== myAddress) {
          send_qty = voutList[outAdr];
          send_coin = "FLUX";
          send_usd = send_qty * coin_value/100000000;
          send_comment = msg;
          gas_coin = "FLUX";
          gas_usd = (gas_fee as number) * coin_value/100000000;
  
          if (csvFormat === CSVFormat.CoinTrackerExport) {
            data.push(send_csv_ctExport(dateTime, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
              send_qty, send_coin, send_usd, send_name, outAdr, send_comment, gas_fee, gas_coin, gas_usd));
          }
          if (csvFormat === CSVFormat.CoinTracker) {
            data.push(send_csv_ct(dateTime, recv_qty, recv_coin, send_qty, send_coin, gas_fee, gas_coin, ""));
          }
          gas_fee = 0;
        }
      });
    } else if (hasVout) {
      type = "RECEIVED";
      Object.keys(voutList).forEach(outAdr => {
        if (outAdr === myAddress) {
          recv_qty = voutList[outAdr];
          recv_coin = "FLUX";
          recv_usd = recv_qty * coin_value/100000000;
          recv_comment = msg;
          gas_fee = ''; // No fee to  receive
          if (csvFormat === CSVFormat.CoinTrackerExport) {
            data.push(send_csv_ctExport(dateTime, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
              send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd));
          }
          if (csvFormat === CSVFormat.CoinTracker) {
            data.push(send_csv_ct(dateTime, recv_qty, recv_coin, send_qty, send_coin, gas_fee, gas_coin, ""));
          }
        }
      });
    } else {
      console.log(`Ignored transaction ${txid} winsum voutlist note`);
      console.log(txn.data.vin);
      console.log(txn.data.vout);
      console.log(`has in ${hasVin} out ${hasVout} Note ${msg}`);
    }
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scanWalletData(updateStatus: (message: string) => void, responseData: string, myAddress:string): Promise<{ data: string[], rows: number }> {
  try {
    const TXNs = JSON.parse(responseData) as WalletResponse;

    let data: string[] = [];
    let rows: number = 0;
    if (!TXNs || !TXNs.data) {
      console.log(responseData);
      console.error("Invalid response structure.");
      data.push("Invalid response structure.");
      return {data, rows};
    }

    //console.log(`Status: ${txns.status}`);
    //console.log(`There are ${txns.data.length} transactions.`);
    const txids = TXNs.data;
    let txns: Txn[] = [];
    let start: number = txids.length-1;
    let finish: number = 0;

    txns[start] = await fetchTransaction(txids[start].txid)
    txns[finish] = await fetchTransaction(txids[finish].txid)
    if (startDate != 0 && txids.length > 10) {
      let done: boolean = false;
      let nstart: number = start;
      let nfinish: number = finish;
      while (!done) {
        if (nstart - nfinish < 5) done = true;
        if (txns[nstart].data.time >= startDate) done = true; // Our Start is after the startDate
        else if (txns[nfinish].data.time < startDate) done = true; // Our Finish is before startDate
        else {
          let next: number = Math.floor(nfinish + (nstart - nfinish)/2);
          if (txns[next] == undefined) txns[next] = await fetchTransaction(txids[next].txid);
          if (txns[next].data.time <= startDate) nstart = next;
          else nfinish = next;
        }
      }
      start = nstart;
    }
    
    if (txns[start] == undefined) txns[start] = await fetchTransaction(txids[start].txid)
    if (txns[finish] == undefined) txns[finish] = await fetchTransaction(txids[finish].txid)
    if (endDate != 0 && txids.length > 10) {
      let done: boolean = false;
      let nstart: number = start;
      let nfinish: number = finish;
      while (!done) {
        if (nstart - nfinish < 5) done = true;
        if (txns[nfinish].data.time <= endDate) done = true; // Our Finish is after the endDate
        else if (txns[nstart].data.time > endDate) done = true; // Our Start is before startDate
        else {
          let next: number = Math.floor(nfinish + (nstart - nfinish)/2);
          if (txns[next] == undefined) txns[next] = await fetchTransaction(txids[next].txid);
          if (txns[next].data.time <= endDate) nstart = next;
          else nfinish = next;
        }
      }
      finish = nfinish;
    }
    
    if (csvFormat === CSVFormat.CoinTracker) {
      data.push("Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Tag");
      rows = rows + 1;
    }

    for (let index = start; index >= finish; index--) {
      var txn: Txn;
      if (txns[index] == undefined) txn = await fetchTransaction(txids[index].txid);
      else txn = txns[index];
      if (txn.data.time < startDate || txn.data.time > endDate) continue;
      let newrows = await decodeTransaction(txn, myAddress);
      if (newrows !== null) {
        newrows?.forEach(row => { data.push(row); rows = rows + 1;});
      }
      updateStatus(`Processed ${rows} transactions.`);
    }
    return {data, rows};
  } catch (error) {
    console.error("Error parsing or processing wallet data:", error);
  }
  const data:string[] = ["Error parsing or processing wallet data"];
  const rows:number = 0;
  return {data, rows};
}
