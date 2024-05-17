import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  Signer,
} from "@solana/web3.js";

type CostTrackerItem = {
  text: string;
  balance: number;
};

export class CostTracker {
  private costsTracker: Record<string, CostTrackerItem[]> = {};
  private connection: anchor.web3.Connection;

  constructor(connection: anchor.web3.Connection) {
    this.connection = connection;
  }

  public async track(text: string, pubKey: anchor.web3.PublicKey) {
    if (!this.costsTracker[pubKey.toString()]) {
      this.costsTracker[pubKey.toString()] = [];
    }

    const balance = await this.connection.getBalance(pubKey);
    this.costsTracker[pubKey.toString()].push({ text, balance });
  }

  public logBalances() {
    for (const key in this.costsTracker) {
      let previousBalance: number | null = null;
      let totalCosts = 0;
      for (const item of this.costsTracker[key]) {
        if (previousBalance) {
          let diff = previousBalance - item.balance;
          console.log(`${key}: ${item.text}: ${diff / LAMPORTS_PER_SOL} SOL`);
          totalCosts += diff;
        }
        previousBalance = item.balance;
      }
      console.log(`${key}: Total costs: ${totalCosts / LAMPORTS_PER_SOL} SOL`);
    }
  }
}

export const setupMintTokenExtension = async (
  connection: anchor.web3.Connection,
  tokenClaimPDA: PublicKey,
  authority: Signer,
  payer: Signer
): Promise<TokenClaimSetup> => {
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const tokensClaimPDAAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint,
    tokenClaimPDA,
    true,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  let mintSig = await mintTo(
    connection,
    payer,
    mint,
    tokensClaimPDAAta.address,
    payer,
    100000,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  await getTxDetails(connection, mintSig);

  return {
    mint,
  };
};

export const setupMint = async (
  connection: anchor.web3.Connection,
  tokenClaimPDA: PublicKey,
  authority: Signer,
  payer: Signer
): Promise<TokenClaimSetup> => {
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);

  const tokensClaimPDAAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint,
    tokenClaimPDA,
    true
  );

  let mintSig = await mintTo(
    connection,
    payer,
    mint,
    tokensClaimPDAAta.address,
    payer,
    100000
  );

  await getTxDetails(connection, mintSig);

  return {
    mint,
  };
};

export type TokenClaimSetup = {
  mint: PublicKey;
};

export const getReturnLog = (confirmedTransaction) => {
  const prefix = "Program return: ";
  let log = confirmedTransaction.meta.logMessages.find((log) =>
    log.startsWith(prefix)
  );
  log = log.slice(prefix.length);
  const [key, data] = log.split(" ", 2);
  const buffer = Buffer.from(data, "base64");
  return [key, data, buffer];
};

export const buildVersionedTx = async (
  connection: anchor.web3.Connection,
  payer: PublicKey,
  tx: Transaction
) => {
  const blockHash = (await connection.getLatestBlockhash("processed"))
    .blockhash;

  let messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockHash,
    instructions: tx.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
};

export const getTxDetails = async (connection: anchor.web3.Connection, sig) => {
  const latestBlockHash = await connection.getLatestBlockhash("processed");

  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    },
    "confirmed"
  );

  return await connection.getTransaction(sig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
};
