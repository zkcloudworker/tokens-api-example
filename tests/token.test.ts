import { describe, expect, it } from "@jest/globals";
import Client from "mina-signer";
import { MinaTokensAPI } from "../src/api";
import { TEST_ACCOUNTS, API_KEY } from "../env.json";

const api = new MinaTokensAPI({
  apiKey: API_KEY,
  chain: "devnet",
});
const client = new Client({ network: "testnet" });

const exampleTokenAddress =
  "B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848";
const exampleJobId = "zkCWVpacSHOyxrVphliRKWnzcieXdPiHbR1eJYpP2Q0wBTF0";
const exampleFailedJobId = "zkCWvcg1BiPdLmsyxexOkrC3qZfx2UdLan0JB30cKDYVeSMB";
const exampleHash = "5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1";
const exampleNFTAddress =
  "B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt";
const exampleBalanceRequest = {
  tokenAddress: "B62qqXt9jJANADWZM4ovXx2bVRrMyjc26J9kCBnLVQMzqMNmmhVj7p4",
  address: TEST_ACCOUNTS[1].publicKey,
};
let offer: string | undefined = undefined;
let bid: string | undefined = undefined;

describe("MinaTokensAPI", () => {
  let tokenAddress: string | undefined = undefined;

  const users = TEST_ACCOUNTS;
  const admin = users[0];
  const tokenHolders = users.slice(1);

  const useWhitelists = true;
  const whitelist = useWhitelists
    ? [
        { address: tokenHolders[0].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[1].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[2].publicKey, amount: 1000_000_000_000 },
      ]
    : undefined;
  const tokenSymbol = "TEST";
  const tokenDecimals = 9;
  const uri = "https://minatokens.com";
  let step:
    | "started"
    | "deployed"
    | "minted"
    | "offered"
    | "bought"
    | "withdrawn"
    | "transferred" = "started";

  it.skip(`should get transaction status`, async () => {
    console.log("Getting existing transaction status...");
    const status = await api.txStatus({
      hash: exampleHash,
    });
    expect(status?.status).toBe("applied");
  });

  it(`should get job result`, async () => {
    console.log("Getting existing job result...");
    const result = await api.proveJobResult({
      jobId: exampleJobId,
    });
    expect(result?.jobStatus).toBe("used");
  });

  it(`should get failed job result`, async () => {
    console.log("Getting existing failed job result...");
    const result = await api.proveJobResult({
      jobId: exampleFailedJobId,
    });
    expect(result?.jobStatus).toBe("failed");
  });

  it(`should get token balance`, async () => {
    console.log("Getting token balance...");
    const result = await api.getBalance({
      tokenAddress: "B62qouKMtMcUxabk72vwZS7tY3XYEca1CPKgXPfznCHUiVjP9E6xxQz",
      address: "B62qmoZqbXP3zRDFiVhczH6XXzHN2jhEq6dT9XqZ4trc1Y8oXyCAJgK",
    });
    expect(result?.balance).toBe(940_000_000_000);
  });

  it.skip(`should get existing token info`, async () => {
    console.log("Getting existing token info...");
    const tokenInfo = await api.getTokenInfo(exampleTokenAddress);
    expect(tokenInfo?.tokenAddress).toBe(exampleTokenAddress);
  });

  it.skip(`should get existing NFT info`, async () => {
    console.log("Getting existing NFT info...");
    const nftInfo = await api.getNFTInfo({
      contractAddress:
        "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT",
      nftAddress: exampleNFTAddress,
    });
    expect(nftInfo?.contractAddress).toBe(
      "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT"
    );
    expect(nftInfo?.nftAddress).toBe(exampleNFTAddress);
  });

  it.skip(`should call faucet`, async () => {
    const key = client.genKeys();
    console.log("Calling faucet for key:", key);
    const status = await api.faucet({ address: key.publicKey });
    console.log(`Faucet response for ${key.publicKey}:`, status);
  });

  it(`should deploy token`, async () => {
    console.log("Deploying new token...");
    console.log("Admin address:", admin.publicKey);

    const tx = await api.buildDeployTokenTransaction({
      adminAddress: admin.publicKey,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      uri,
      whitelist,
    });

    const { adminContractAddress, mina_signer_payload } = tx;
    tokenAddress = tx.tokenAddress;
    console.log("Token address:", tokenAddress);
    console.log("Admin contract address:", adminContractAddress);

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(mina_signer_payload, admin.privateKey).data
      ),
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "deployed";
  });

  it(`should mint token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("deployed");

    console.log("Building mint transaction...");

    const tx = await api.tokenTransaction({
      txType: "mint",
      from: admin.publicKey,
      tokenAddress,
      to: tokenHolders[0].publicKey,
      amount: 1000_000_000_000,
    });

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(tx.mina_signer_payload, admin.privateKey).data
      ),
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "minted";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of token holder 0:`, balance);
  });

  it(`should offer token for sale`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("minted");

    console.log("Building offer transaction...");

    const tx = await api.tokenTransaction({
      txType: "offer",
      from: tokenHolders[0].publicKey,
      tokenAddress,
      amount: 500_000_000_000,
      price: 100_000_000,
      whitelist,
    });
    offer = tx.to;

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(
          tx.mina_signer_payload,
          tokenHolders[0].privateKey
        ).data
      ),
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    console.log("Offer contract address:", offer);
    step = "offered";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of ${tokenHolders[0].publicKey}:`, balance);
    const balanceOffer = await api.getBalance({
      tokenAddress,
      address: offer,
    });
    console.log(`Balance of offer ${offer}:`, balanceOffer);
  });

  it(`should buy token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offer) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("offered");

    console.log("Building buy transaction...");

    const tx = await api.tokenTransaction({
      txType: "buy",
      to: tokenHolders[1].publicKey,
      tokenAddress,
      from: offer,
      amount: 10_000_000_000,
    });

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(
          tx.mina_signer_payload,
          tokenHolders[1].privateKey
        ).data
      ),
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "bought";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[1].publicKey,
    });
    console.log(`Balance of buyer:`, balance);
    const balanceOffer = await api.getBalance({
      tokenAddress,
      address: offer,
    });
    console.log(`Balance of offer:`, balanceOffer);
  });

  it(`should withdraw token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offer) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("bought");

    console.log("Building withdraw transaction...");

    const tx = await api.tokenTransaction({
      txType: "withdrawOffer",
      to: tokenHolders[0].publicKey,
      tokenAddress,
      from: offer,
      amount: 490_000_000_000,
    });

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(
          tx.mina_signer_payload,
          tokenHolders[0].privateKey
        ).data
      ),
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "withdrawn";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of token holder 0:`, balance);
    const balanceOffer = await api.getBalance({
      tokenAddress,
      address: offer,
    });
    console.log(`Balance of offer:`, balanceOffer);
  });

  it(`should transfer token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("withdrawn");

    console.log("Building transfer transaction...");

    const tx = await api.tokenTransaction({
      txType: "transfer",
      from: tokenHolders[0].publicKey,
      tokenAddress,
      to: tokenHolders[2].publicKey,
      amount: 50_000_000_000,
    });

    const proveTx = await api.proveTokenTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(
          tx.mina_signer_payload,
          tokenHolders[0].privateKey
        ).data
      ),
    });
    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "transferred";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of token holder 0:`, balance);
    const balanceTransfer = await api.getBalance({
      tokenAddress,
      address: tokenHolders[2].publicKey,
    });
    console.log(`Balance of token holder 2:`, balanceTransfer);
  });
});
