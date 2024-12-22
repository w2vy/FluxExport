interface Txid {
  txid: string;
}

interface TxnResponse {
  status: string;
  data: Txid[];
}

interface Vin {
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

function scanWalletData(responseData: string) {
  try {
    const txns = JSON.parse(responseData) as TxnResponse;

    if (!txns || !txns.data) {
      console.log(responseData);
      console.error("Invalid response structure.");
      return;
    }

    console.log(`Status: ${txns.status}`);
    console.log(`There are ${txns.data.length} transactions.`);

    for (const [index, txn] of txns.data.entries()) {
      console.log(`Transaction ${index}: TXID: ${txn.txid}`);
    }

    console.log("Done.");
  } catch (error) {
    console.error("Error parsing or processing wallet data:", error);
  }
}

async function main() {
  const url = "https://api.runonflux.io/explorer/transactions/t1gdhHCLAxe16P4yt39DBqVZoq9hhgDsoYX";
  const responseData = await fetchWebPageData(url);

  if (responseData) {
    scanWalletData(responseData);
  } else {
    console.log("Failed to retrieve data.");
  }
}

main();
