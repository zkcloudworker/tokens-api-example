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
const exampleHash = "5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1";
const exampleNFTAddress =
  "B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt";

describe("MinaTokensAPI", () => {
  let tokenAddress: string | undefined = undefined;
  let adminContractAddress: string | undefined = undefined;

  const users = TEST_ACCOUNTS;
  const admin = users[0];
  const tokenHolders = users.slice(1);
  const tokenSymbol = "TEST";
  const tokenDecimals = 9;
  const uri = "https://minatokens.com";
  let step: "started" | "deployed" | "minted" | "transferred" = "started";

  it(`should get transaction status`, async () => {
    console.log("Getting existing transaction status...");
    const status = await api.txStatus({
      hash: exampleHash,
    });
    console.log(status);
  });

  it(`should get job result`, async () => {
    console.log("Getting existing job result...");
    const result = await api.proveJobResult({
      jobId: exampleJobId,
    });
    console.log(result);
  });

  it(`should get existing token info`, async () => {
    console.log("Getting existing token info...");
    const tokenInfo = await api.getTokenInfo(exampleTokenAddress);
    console.log(tokenInfo);
  });

  it(`should get existing NFT info`, async () => {
    console.log("Getting existing NFT info...");
    const nftInfo = await api.getNFTInfo({
      contractAddress:
        "B62qs2NthDuxAT94tTFg6MtuaP1gaBxTZyNv9D3uQiQciy1VsaimNFT",
      nftAddress: exampleNFTAddress,
    });
    console.log(nftInfo);
  });

  it(`should call faucet`, async () => {
    const key = client.genKeys();
    console.log("Calling faucet for key:", key);
    const status = await api.faucet({ address: key.publicKey });
    console.log(`Faucet response for ${key.publicKey}:`, status);
  });

  it(`should deploy token`, async () => {
    console.log("Deploying new token...");
    console.log("Admin address:", admin.publicKey);

    const builtTx = await api.buildDeployTokenTransaction({
      adminAddress: admin.publicKey,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      uri,
    });
    const { serializedTransaction, payload } = builtTx;

    const signBody = {
      zkappCommand: JSON.parse(payload.transaction),
      feePayer: {
        feePayer: admin.publicKey,
        fee: payload.feePayer.fee,
        nonce: payload.nonce,
        memo: payload.feePayer.memo,
      },
    };

    const signedResult = client.signTransaction(signBody, admin.privateKey);
    const signedData = JSON.stringify(signedResult.data);
    tokenAddress = builtTx.tokenAddress;
    adminContractAddress = builtTx.adminContractAddress;
    console.log("Token address:", tokenAddress);
    console.log("Admin contract address:", adminContractAddress);

    const proveTx = await api.proveTokenTransaction({
      txType: "deploy",
      serializedTransaction,
      signedData,
      senderAddress: admin.publicKey,
      tokenAddress,
      adminContractAddress,
      symbol: tokenSymbol,
      uri,
      sendTransaction: true,
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
    expect(adminContractAddress).toBeDefined();
    if (!tokenAddress || !adminContractAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("deployed");

    console.log("Building mint transaction...");

    const builtTx = await api.tokenTransaction({
      txType: "mint",
      symbol: tokenSymbol,
      senderAddress: admin.publicKey,
      tokenAddress: tokenAddress,
      adminContractAddress: adminContractAddress,
      to: tokenHolders[0].publicKey,
      amount: 100_000_000_000,
    });
    const { serializedTransaction, payload } = builtTx;
    const signBody = {
      zkappCommand: JSON.parse(payload.transaction),
      feePayer: {
        feePayer: admin.publicKey,
        fee: payload.feePayer.fee,
        nonce: payload.nonce,
        memo: payload.feePayer.memo,
      },
    };

    const signedResult = client.signTransaction(signBody, admin.privateKey);
    const signedData = JSON.stringify(signedResult.data);

    const proveTx = await api.proveTokenTransaction({
      txType: "mint",
      serializedTransaction,
      signedData,
      senderAddress: admin.publicKey,
      tokenAddress,
      adminContractAddress,
      symbol: tokenSymbol,
      to: tokenHolders[0].publicKey,
      amount: 100_000_000_000,
      sendTransaction: true,
    });

    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "minted";
  });

  it(`should transfer token`, async () => {
    expect(tokenAddress).toBeDefined();
    expect(adminContractAddress).toBeDefined();
    if (!tokenAddress || !adminContractAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("minted");

    console.log("Building transfer transaction...");

    const builtTx = await api.tokenTransaction({
      txType: "transfer",
      symbol: tokenSymbol,
      senderAddress: tokenHolders[0].publicKey,
      tokenAddress: tokenAddress,
      adminContractAddress: adminContractAddress,
      to: tokenHolders[1].publicKey,
      amount: 50_000_000_000,
    });
    const { serializedTransaction, payload } = builtTx;

    const signBody = {
      zkappCommand: JSON.parse(payload.transaction),
      feePayer: {
        feePayer: tokenHolders[0].publicKey,
        fee: payload.feePayer.fee,
        nonce: payload.nonce,
        memo: payload.feePayer.memo,
      },
    };

    const signedResult = client.signTransaction(
      signBody,
      tokenHolders[0].privateKey
    );
    const signedData = JSON.stringify(signedResult.data);

    const proveTx = await api.proveTokenTransaction({
      txType: "transfer",
      serializedTransaction,
      signedData,
      senderAddress: tokenHolders[0].publicKey,
      tokenAddress,
      adminContractAddress,
      symbol: tokenSymbol,
      to: tokenHolders[1].publicKey,
      amount: 50_000_000_000,
      sendTransaction: true,
    });
    const hash = await api.waitForJobResult(proveTx.jobId);
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "transferred";
  });
});
