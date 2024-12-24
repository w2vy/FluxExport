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

const single:boolean = false;

function formatTimestamp(epochTime: number): string {
  const edate = new Date(epochTime * 1000); // Multiply by 1000 to convert seconds to milliseconds

  const day = String(edate.getDate()).padStart(2, '0');
  const month = String(edate.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = edate.getFullYear();

  const hours = String(edate.getHours()).padStart(2, '0');
  const minutes = String(edate.getMinutes()).padStart(2, '0');
  const seconds = String(edate.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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

function send_csv(
  date: string, type: string, txid: string, recv_qty: string | number, recv_coin: string, recv_usd: number | string, recv_name: string, recv_adr: string,
  recv_comment: string, send_qty: any, send_coin: string, send_usd: any, send_name: string, send_adr: string, send_comment: string, gas_fee: any,
  gas_coin: string, gas_usd: any
): void {
  if (typeof recv_usd === "number" && recv_usd as number > 0 && recv_usd as number < 0.0001) recv_usd = 0;
  if (typeof send_usd === "number" && send_usd as number > 0 && send_usd as number < 0.0001) send_usd = 0;
  if (typeof gas_usd === "number" && gas_usd as number > 0 && gas_usd as number < 0.0001) gas_usd = 0;
  if (typeof recv_qty === "number" && recv_qty > 0) recv_qty = (recv_qty/100000000).toFixed(8);
  if (typeof send_qty === "number" && send_qty > 0) send_qty = (send_qty/100000000).toFixed(8);
  if (typeof gas_fee === "number" && gas_fee > 0) gas_fee = (gas_fee/100000000).toFixed(8);
  const csvRow = [
    date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
    send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd
  ].join(",");
  console.log(csvRow);
}

async function decodeTransaction(i: number, txid: string, myAddress:string) {
  const url = 'https://api.runonflux.io/daemon/getrawtransaction?verbose=1&txid=' + txid;
  if (!isValidTxid(txid)) console.log(`decodeTransaction: bad txid len ${txid.length} ${txid}`);
  else {
    const responseData = await fetchWebPageData(url);

    if (!responseData) {
      console.log("Failed to retrieve data.");
      return;
    }
    var txn = JSON.parse(responseData) as Txn;
    if (!txn || !txn.data) {
      console.log(responseData);
      console.error("Invalid Txn structure.");
      return;
    }

    if (txn.status != "success") {
      console.log("**************************************************************************************")
      console.log(`status: ${txn.status} URL: ${url}`);
      console.log(`Data size ${responseData.length} ${responseData}`);
      console.log(txn);
      sleep(1);
      const responseData2 = await fetchWebPageData(url);

      if (!responseData2) {
        console.log("Failed to retrieve data.");
        return;
      }
      const txn2 = JSON.parse(responseData2) as Txn;
      if (!txn2 || !txn2.data) {
        console.log(responseData2);
        console.error("Invalid Txn structure.");
        return;
      }
  
      if (txn.status != "success") {
        console.log(`****************************** GET FAILED ${txid} *******************************************************`)
        return;
      }
      txn = txn2;
    }
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

    const date:string = formatTimestamp(txn.data.time);
    if (hasVin && hasVout && voutAllMe) { // Sent to self (same wallet)
      type = "SENT";
      send_qty = 0;
      send_coin = "FLUX";
      send_usd = "0";
      send_adr = myAddress;
      recv_adr = myAddress;
      gas_coin = "FLUX";
      gas_usd = gas_fee*coin_value/100000000;
      send_csv(date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
        send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd);
    } else if (mined) {
      type = "MINED";
      recv_qty = voutList[myAddress];
      recv_coin = "FLUX";
      recv_usd = recv_qty*coin_value/100000000;
      gas_fee = 0;
      gas_usd = 0;
      //console.log(`Mined ${date}`);
      send_csv(date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
        send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd);
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
    
            send_csv(date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
              send_qty, send_coin, send_usd, send_name, outAdr, send_comment, gas_fee, gas_coin, gas_usd);
            gas_fee = 0;
          }
        });
      } else if (hasVout) {
        type = "RECEIVED";
        Object.keys(voutList).forEach(outAdr => {
          if (outAdr === myAddress) {
            recv_qty = voutList[outAdr];
            recv_coin = "FLUX";
            recv_usd = recv_qty * coin_value/10000000;
            recv_comment = msg;
            gas_fee = ''; // No fee to  receive
            send_csv(date, type, txid, recv_qty, recv_coin, recv_usd, recv_name, recv_adr, recv_comment,
              send_qty, send_coin, send_usd, send_name, send_adr, send_comment, gas_fee, gas_coin, gas_usd);
          }
        });
      } else {
        console.log(`Ignored transaction ${txid} winsum voutlist note`);
        console.log(txn.data.vin);
        console.log(txn.data.vout);
        console.log(`has in ${hasVin} out ${hasVout} Note ${msg}`);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scanWalletData(responseData: string, myAddress:string) {
  try {
    const txns = JSON.parse(responseData) as WalletResponse;

    if (!txns || !txns.data) {
      console.log(responseData);
      console.error("Invalid response structure.");
      return;
    }

    //console.log(`Status: ${txns.status}`);
    //console.log(`There are ${txns.data.length} transactions.`);

    if (false) {
      await Promise.all(txns.data.map((txn, index) => decodeTransaction(index + 1, txn.txid, myAddress)));
    } else {
      for (const [index, txn] of txns.data.entries()) {
        //console.log(`Transaction ${index}: TXID: ${txn.txid}`);
        await decodeTransaction(index, txn.txid, myAddress);
      }
    }
    //console.log("Done.");
  } catch (error) {
    console.error("Error parsing or processing wallet data:", error);
  }
}

async function main() {
  //const myAddress = 't1gdhHCLAxe16P4yt39DBqVZoq9hhgDsoYX';
  const myAddress = 't1UHecy6WiSJXs4Zqt5UvVdRDF7PMbZJK7q';
  const url = "https://api.runonflux.io/explorer/transactions/" + myAddress;
  const responseData = await fetchWebPageData(url);

  if (responseData) {
    scanWalletData(responseData, myAddress);
  } else {
    console.log("Failed to retrieve data.");
  }
}

if (!single) main();
else {
  // test these
  // 9515af7448b32855bd84246a50d39c36477597bda37a67513e4730ae1591ae54 send payment, ignore myAddress
  const txid = '9515af7448b32855bd84246a50d39c36477597bda37a67513e4730ae1591ae54';
  const vin1 = 't1NQRqtQW3bbRP6oSNsvXyBMUrjVJUpcBXb';
  const vout1 = 't1a2Vh8pSR5yaLh6DYeGt2LpMX3PTuBgauo';
  const myAddress = 't1UHecy6WiSJXs4Zqt5UvVdRDF7PMbZJK7q';
  decodeTransaction(995, txid, myAddress);
}