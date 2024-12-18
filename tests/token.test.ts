import { describe, expect, it } from "@jest/globals";
import Client from "mina-signer";
import { MinaTokensAPI } from "@minatokens/api";
import { TEST_ACCOUNTS, API_KEY } from "../env.json";

type Chain = "zeko" | "devnet";
const chain: Chain = "devnet" as Chain;
const debug = false;
if (debug) {
  console.log("Debug mode enabled");
  process.env.DEBUG = "true";
}

const api = new MinaTokensAPI({
  apiKey: API_KEY,
  chain,
});
const client = new Client({ network: "testnet" });

const exampleTokenAddress =
  "B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848";
const exampleJobId = "zkCWDYE3gAJOGRDqNlhke0u1NWVXlWgKS2uk2q0FgZdRbPoF";
const exampleFailedJobId = "zkCWvcg1BiPdLmsyxexOkrC3qZfx2UdLan0JB30cKDYVeSMB";
const exampleHash = "5JuEaWqCkiizzjA3mjrva5hjYeohiGKQFcffUdZxrEJM4xDirhK1";
const exampleNFTAddress =
  "B62qoT6jXebkJVmsUmxCxGJmvHJUXPNF417rms4PATi5R6Hw7e56CRt";
const exampleBalanceRequest = {
  tokenAddress: "B62qqXt9jJANADWZM4ovXx2bVRrMyjc26J9kCBnLVQMzqMNmmhVj7p4",
  address: TEST_ACCOUNTS[1].publicKey,
};
let offerAddress: string | undefined = undefined;
let bidAddress: string | undefined = undefined;

describe("MinaTokensAPI", () => {
  let tokenAddress: string | undefined = undefined;

  const users = TEST_ACCOUNTS;
  const admin = users[0];
  const tokenHolders = users.slice(1);
  console.log("admin:", admin.publicKey);
  console.log(
    "Token holders:",
    tokenHolders.slice(0, 3).map((t) => t.publicKey)
  );

  const useWhitelists = false;
  const whitelist = useWhitelists
    ? [
        { address: tokenHolders[0].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[1].publicKey, amount: 1000_000_000_000 },
        { address: tokenHolders[2].publicKey, amount: 1000_000_000_000 },
      ]
    : undefined;
  console.log("Whitelist:", whitelist);
  const tokenSymbol = "TEST";
  const tokenDecimals = 9;
  const uri = "https://minatokens.com";
  let step:
    | "started"
    | "deployed"
    | "minted"
    | "bid"
    | "sold"
    | "offered"
    | "bought"
    | "withdrawn"
    | "transferred"
    | "airdropped" = "started";

  it(`should get transaction status`, async () => {
    console.log("Getting existing transaction status...");
    const status = await api.txStatus({
      hash: exampleHash,
    });
    expect(status?.status).toBe("applied");
  });

  it(`should get job result`, async () => {
    console.log("Getting existing job result...");
    const result = await api.getProof({
      jobId: exampleJobId,
    });
    expect(result?.jobStatus).toBe("used");
  });

  it(`should get failed job result`, async () => {
    console.log("Getting existing failed job result...");
    const result = await api.getProof({
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
    if (chain === "devnet") {
      expect(result?.balance).toBe(940_000_000_000);
    } else {
      expect(result?.balance).toBe(null);
    }
  });

  it(`should get existing token info`, async () => {
    console.log("Getting existing token info...");

    if (chain === "devnet") {
      const tokenInfo = await api.getTokenInfo(exampleTokenAddress);
      expect(tokenInfo?.tokenAddress).toBe(exampleTokenAddress);
    } else {
      const tokenInfo = await api.getTokenInfo(
        "B62qphSRYqif9bPjw4Kg2G3CA7V7NzHqtpRzeXkY164n3C9jXqGAfkA"
      );
      expect(tokenInfo?.tokenAddress).toBe(
        "B62qphSRYqif9bPjw4Kg2G3CA7V7NzHqtpRzeXkY164n3C9jXqGAfkA"
      );
    }
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

    const tx = await api.buildTransaction({
      txType: "launch",
      adminContract: useWhitelists ? "advanced" : "standard",
      sender: admin.publicKey,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      uri,
      whitelist: useWhitelists ? whitelist : undefined,
      canMint: "whitelist",
    });

    const { minaSignerPayload } = tx;
    if (!("adminContractAddress" in tx.request))
      throw new Error("Token not deployed");
    const adminContractAddress = tx.request.adminContractAddress;
    tokenAddress = tx.request.tokenAddress;
    if (!tokenAddress) throw new Error("Token not deployed");
    console.log("Token address:", tokenAddress);
    console.log("Admin contract address:", adminContractAddress);

    const proveTx = await api.proveTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(minaSignerPayload, admin.privateKey).data
      ),
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) throw new Error("No hash");
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

    const tx = await api.buildTransaction({
      txType: "mint",
      sender: admin.publicKey,
      tokenAddress,
      to: tokenHolders[0].publicKey,
      amount: 1000_000_000_000,
    });

    const proveTx = await api.proveTransactions({
      txs: [
        {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(tx.minaSignerPayload, admin.privateKey).data
          ),
        },
      ],
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
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
    expect(balance?.balance).toBe(1000_000_000_000);
  });

  it(`should bid`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("minted");

    console.log("Building bid transaction...");

    const tx = await api.buildTransaction({
      txType: "bid",
      sender: tokenHolders[4].publicKey,
      tokenAddress,
      amount: 100_000_000_000,
      price: 100_000_000,
      whitelist: useWhitelists ? whitelist : undefined,
    });
    if (!("bidAddress" in tx.request)) throw new Error("Token not bid");
    bidAddress = tx.request.bidAddress;
    if (!bidAddress) throw new Error("Token not bid");

    const proveTx = await api.proveTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(tx.minaSignerPayload, tokenHolders[4].privateKey)
          .data
      ),
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    console.log("Bid contract address:", bidAddress);
    step = "bid";
    const balance = await api.getBalance({
      address: bidAddress,
    });
    console.log(`Balance of ${bidAddress}:`, balance);
    expect(balance?.balance).toBe(10_000_000_000);
  });

  it(`should sell token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!bidAddress) {
      throw new Error("Token not bid");
    }
    expect(step).toBe("bid");

    console.log("Building sell transaction...");

    const tx = await api.buildTransaction({
      txType: "sell",
      sender: tokenHolders[0].publicKey,
      tokenAddress,
      bidAddress,
      amount: 5_000_000_000,
    });

    const proveTx = await api.proveTransactions({
      txs: [
        {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload,
              tokenHolders[0].privateKey
            ).data
          ),
        },
      ],
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    step = "sold";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of seller:`, balance);
    const balanceBuyer = await api.getBalance({
      tokenAddress,
      address: tokenHolders[4].publicKey,
    });
    console.log(`Balance of buyer:`, balanceBuyer);
    expect(balance?.balance).toBe(995_000_000_000);
    expect(balanceBuyer?.balance).toBe(5_000_000_000);
  });

  it(`should offer token for sale`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("sold");

    console.log("Building offer transaction...");

    const tx = await api.buildTransaction({
      txType: "offer",
      sender: tokenHolders[0].publicKey,
      tokenAddress,
      amount: 500_000_000_000,
      price: 10_000_000_000,
      whitelist: useWhitelists ? whitelist : undefined,
    });
    if (!("offerAddress" in tx.request)) throw new Error("Token not offered");
    offerAddress = tx.request.offerAddress;
    if (!offerAddress) throw new Error("Token not offered");

    const proveTx = await api.proveTransaction({
      tx,
      signedData: JSON.stringify(
        client.signTransaction(tx.minaSignerPayload, tokenHolders[0].privateKey)
          .data
      ),
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    console.log("Offer contract address:", offerAddress);
    step = "offered";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of ${tokenHolders[0].publicKey}:`, balance);
    expect(balance?.balance).toBe(495_000_000_000);
    const balanceOffer = await api.getBalance({
      tokenAddress,
      address: offerAddress,
    });
    console.log(`Balance of offer ${offerAddress}:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(500_000_000_000);
  });

  it(`should buy token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offerAddress) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("offered");
    const balanceBefore = await api.getBalance({
      address: tokenHolders[1].publicKey,
    });
    console.log(
      `Balance of ${tokenHolders[1].publicKey} in MINA:`,
      (balanceBefore?.balance ?? 0) / 1_000_000_000
    );

    console.log("Building buy transaction...");

    const tx = await api.buildTransaction({
      txType: "buy",
      sender: tokenHolders[1].publicKey,
      tokenAddress,
      offerAddress,
      amount: 10_000_000_000,
    });

    const proveTx = await api.proveTransactions({
      txs: [
        {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload,
              tokenHolders[1].privateKey
            ).data
          ),
        },
      ],
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
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
      address: offerAddress,
    });
    expect(balance?.balance).toBe(10_000_000_000);
    console.log(`Balance of offer:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(490_000_000_000);
    const balanceAfter = await api.getBalance({
      address: tokenHolders[1].publicKey,
    });
    console.log(
      `Balance of ${tokenHolders[1].publicKey} in MINA:`,
      (balanceAfter?.balance ?? 0) / 1_000_000_000
    );
    console.log(
      `Balance difference:`,
      ((balanceAfter?.balance ?? 0) - (balanceBefore?.balance ?? 0)) /
        1_000_000_000
    );
  });

  it(`should withdraw token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    if (!offerAddress) {
      throw new Error("Token not offered");
    }
    expect(step).toBe("bought");

    console.log("Building withdraw transaction...");

    const tx = await api.buildTransaction({
      txType: "withdrawOffer",
      sender: tokenHolders[0].publicKey,
      tokenAddress,
      offerAddress,
      amount: 490_000_000_000,
    });

    const proveTx = await api.proveTransactions({
      txs: [
        {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload,
              tokenHolders[0].privateKey
            ).data
          ),
        },
      ],
    });

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
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
    expect(balance?.balance).toBe(985_000_000_000);
    const balanceOffer = await api.getBalance({
      tokenAddress,
      address: offerAddress,
    });
    console.log(`Balance of offer:`, balanceOffer);
    expect(balanceOffer?.balance).toBe(0);
  });

  it(`should transfer token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("withdrawn");

    console.log("Building transfer transaction...");

    const tx = await api.buildTransaction({
      txType: "transfer",
      sender: tokenHolders[0].publicKey,
      tokenAddress,
      to: tokenHolders[2].publicKey,
      amount: 50_000_000_000,
    });

    const proveTx = await api.proveTransactions({
      txs: [
        {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload,
              tokenHolders[0].privateKey
            ).data
          ),
        },
      ],
    });
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
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
    expect(balance?.balance).toBe(935_000_000_000);
    const balanceTransfer = await api.getBalance({
      tokenAddress,
      address: tokenHolders[2].publicKey,
    });
    console.log(`Balance of token holder 2:`, balanceTransfer);
    expect(balanceTransfer?.balance).toBe(50_000_000_000);
  });

  it(`should airdrop token`, async () => {
    expect(tokenAddress).toBeDefined();
    if (!tokenAddress) {
      throw new Error("Token not deployed");
    }
    expect(step).toBe("transferred");

    console.log("Building airdrop transaction...");

    const recipients = [1, 2, 3].map((i) => ({
      address: client.genKeys().publicKey,
      amount: 10_000_000_000,
    }));

    const airdrop = await api.buildAirdrop({
      txType: "airdrop",
      sender: tokenHolders[0].publicKey,
      tokenAddress,
      recipients,
    });

    const proveTx = await api.proveTransactions({
      txs: airdrop.txs.map((tx) => ({
        tx,
        signedData: JSON.stringify(
          client.signTransaction(
            tx.minaSignerPayload,
            tokenHolders[0].privateKey
          ).data
        ),
      })),
    });
    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(3);
    for (const hash of proofs) {
      expect(hash).toBeDefined();
      if (!hash) return;
      await api.waitForTransaction(hash);
    }
    const tokenInfo = await api.getTokenInfo(tokenAddress);
    console.log(tokenInfo);
    step = "airdropped";
    const balance = await api.getBalance({
      tokenAddress,
      address: tokenHolders[0].publicKey,
    });
    console.log(`Balance of token holder 0:`, balance);
    expect(balance?.balance).toBe(905_000_000_000);
  });
});
