import { describe, expect, it } from "@jest/globals";
import Client from "mina-signer";
import * as api from "@silvana-one/api";
import { TEST_ACCOUNTS, API_KEY } from "../env.json";
import {
  randomName,
  randomText,
  randomImage,
  randomBanner,
} from "../src/random";
import fs from "fs/promises";

type Chain = "zeko" | "devnet" | "mainnet";
const chain: Chain = "devnet" as Chain;
const soulBound = true as boolean;

api.config({
  apiKey: API_KEY,
  chain,
});
const debug = false;
if (debug) {
  console.log("Debug mode enabled");
  process.env.DEBUG = "true";
}

const client = new Client({
  network: chain === "mainnet" ? "mainnet" : "testnet",
});

const exampleNftAddress =
  chain === "zeko"
    ? "B62qnmnETnzpkEVvGQ6jE4PR3YVFY6ZEXxYXWvQPmxcZyJJtj9eGiD6"
    : "B62qn25cKc4ipqJMCDSMENgsiFwL49vTdnsDXgWWKWFXQaY819rn848";

describe("MinaTokensAPI for NFT", () => {
  let collectionAddress: string | undefined = undefined;

  const users = TEST_ACCOUNTS;
  const creator = users[0];
  const nftHolders = users.slice(1);

  let step: "started" | "launched" | "minted" = "started";

  it(`should get NFT info`, async () => {
    const collectionName = randomName();
    console.log(`Launching new NFT collection ${collectionName}...`);

    const info = (
      await api.getNftInfo({
        body: {
          collectionAddress:
            "B62qjRPTy8u1WmqvesxC6VhixvwCzCAFjDjmMwm1LB5viEDTfAWbfz9",
        },
      })
    ).data;
    console.log("NFT info:", info);
  });

  it(`should launch NFT collection`, async () => {
    console.log("creator:", creator.publicKey);
    console.log(
      "NFT holders:",
      nftHolders.slice(0, 3).map((t) => t.publicKey)
    );
    const collectionName = randomName();
    console.log(`Launching new NFT collection ${collectionName}...`);

    const tx = (
      await api.launchNftCollection({
        body: {
          collectionName,
          sender: creator.publicKey,
          adminContract: "standard",
          symbol: "NFT",
          masterNFT: {
            name: collectionName,
            data: {
              owner: creator.publicKey,
            },
            metadata: {
              name: collectionName,
              image: randomImage(),
              banner: randomBanner(),
              description: randomText(),
              traits: [
                {
                  key: "Collection Trait 1",
                  type: "string",
                  value: "Collection Value 1",
                },
                {
                  key: "Collection Trait 2",
                  type: "string",
                  value: "Collection Value 2",
                },
              ],
            },
          },
        },
      })
    ).data;
    if (!tx) throw new Error("Token not deployed");

    const { minaSignerPayload } = tx;
    if (!tx.request || !("adminContractAddress" in tx.request))
      throw new Error("NFT collection is not deployed");
    const adminContractAddress = tx?.request?.adminContractAddress;
    collectionAddress = tx?.request?.collectionAddress;
    if (!collectionAddress) throw new Error("NFT collection is not deployed");
    console.log("NFT collection address:", collectionAddress);
    console.log("Admin contract address:", adminContractAddress);
    console.log("Storage address:", tx?.storage);
    console.log("Metadata root:", tx?.metadataRoot);
    if (tx?.privateMetadata && collectionAddress) {
      await fs.writeFile(
        `./data/collection-${collectionAddress}-metadata.json`,
        tx.privateMetadata
      );
    }

    if (collectionAddress) {
      await fs.writeFile(
        `./data/collection-${collectionAddress}-keys.json`,
        JSON.stringify(
          {
            collectionName,
            collectionAddress,
            masterNFT: tx?.nftName,
            adminContractAddress,
            collectionContractPrivateKey:
              tx?.request?.collectionContractPrivateKey,
            adminContractPrivateKey: tx?.request?.adminContractPrivateKey,
            storage: tx?.storage,
            metadataRoot: tx?.metadataRoot,
          },
          null,
          2
        )
      );
    }

    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(minaSignerPayload as any, creator.privateKey)
              .data
          ),
        },
      })
    ).data;

    if (!proveTx?.jobId) throw new Error("No jobId");

    const proofs = await api.waitForProofs(proveTx?.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) throw new Error("No hash");
    await api.waitForTransaction(hash);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // const tokenInfo = await api.getTokenInfo({
    //   body: { collectionAddress },
    // });
    // console.log(tokenInfo?.data);
    step = "launched";
  });

  it(`should mint NFT`, async () => {
    expect(collectionAddress).toBeDefined();
    if (!collectionAddress) {
      throw new Error("NFT collection is not deployed");
    }
    expect(step).toBe("launched");
    const nftName = randomName();
    console.log(`Minting NFT ${nftName}...`);

    const tx = (
      await api.mintNft({
        body: {
          txType: "nft:mint",
          sender: creator.publicKey,
          collectionAddress,
          nftMintParams: {
            name: nftName,
            data: {
              owner: creator.publicKey,
              canApprove: !soulBound,
              canTransfer: !soulBound,
              canChangeMetadata: false,
              canChangeMetadataVerificationKeyHash: false,
              canChangeName: false,
              canChangeOwnerByProof: false,
              canChangeStorage: false,
              canPause: true,
            },
            metadata: {
              name: nftName,
              image: randomImage(),
              description: randomText(),
              traits: [
                {
                  key: "NFT Trait 1",
                  type: "string",
                  value: "NFT Value 1",
                },
                {
                  key: "NFT Trait 2",
                  type: "string",
                  value: "NFT Value 2",
                },
              ],
            },
          },
        },
      })
    ).data;
    if (!tx) throw new Error("No tx");
    const nftMintParams = (tx?.request as api.NftMintTransactionParams)
      .nftMintParams;
    const nftAddress = nftMintParams?.address;
    if (!nftAddress) throw new Error("NFT not minted");
    console.log("NFT address:", nftAddress);
    console.log("Storage address:", tx?.storage);
    console.log("Metadata root:", tx?.metadataRoot);
    if (tx?.privateMetadata && collectionAddress && nftAddress) {
      await fs.writeFile(
        `./data/nft-${collectionAddress}-${nftAddress}.json`,
        tx.privateMetadata
      );
    }
    if (collectionAddress) {
      await fs.writeFile(
        `./data/nft-${collectionAddress}-${nftAddress}-keys.json`,
        JSON.stringify(
          {
            nftName,
            collectionName: tx?.collectionName,
            collectionAddress,
            nftAddress,
            nftContractPrivateKey: nftMintParams?.addressPrivateKey,
            storage: tx?.storage,
            metadataRoot: tx?.metadataRoot,
          },
          null,
          2
        )
      );
    }
    const proveTx = (
      await api.prove({
        body: {
          tx,
          signedData: JSON.stringify(
            client.signTransaction(
              tx.minaSignerPayload as any,
              creator.privateKey
            ).data
          ),
        },
      })
    ).data;

    if (!proveTx?.jobId) throw new Error("No jobId");

    const proofs = await api.waitForProofs(proveTx.jobId);
    expect(proofs).toBeDefined();
    if (!proofs) throw new Error("No proofs");
    expect(proofs.length).toBe(1);
    const hash = proofs[0];
    expect(hash).toBeDefined();
    if (!hash) return;
    await api.waitForTransaction(hash);
    // const tokenInfo = await api.getTokenInfo({
    //   body: { tokenAddress },
    // });
    // console.log(tokenInfo?.data);
    step = "minted";
  });
});
