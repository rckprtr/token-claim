import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Transaction,
  Connection,
  VersionedTransactionResponse,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";

export function getOrCreateKeypair(dir: string, keyName: string): Keypair {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const authorityKey = dir + "/" + keyName + ".json";
  if (fs.existsSync(authorityKey)) {
    const data: {
      secretKey: string;
      publicKey: string;
    } = JSON.parse(fs.readFileSync(authorityKey, "utf-8"));
    return Keypair.fromSecretKey(bs58.decode(data.secretKey));
  } else {
    const keypair = Keypair.generate();
    keypair.secretKey;
    fs.writeFileSync(
      authorityKey,
      JSON.stringify({
        secretKey: bs58.encode(keypair.secretKey),
        publicKey: keypair.publicKey.toBase58(),
      })
    );
    return keypair;
  }
}

export const printSOLBalance = async (
  connection: Connection,
  pubKey: PublicKey,
  info: string = ""
) => {
  const balance = await connection.getBalance(pubKey);
  console.log(
    `${info ? info + " " : ""}${pubKey.toBase58()}:`,
    balance / LAMPORTS_PER_SOL,
    `SOL`
  );
};

export const getSPLBalanceTokenAmount = async (
  connection: Connection,
  mintAddress: PublicKey,
  pubKey: PublicKey,
  allowOffCurve: boolean = false
) => {
  try {
    let ata = getAssociatedTokenAddressSync(mintAddress, pubKey, allowOffCurve);
    const tokenAmount = await connection.getTokenAccountBalance(
      ata,
      "processed"
    );
    return tokenAmount;
  } catch (e) {}
  return null;
};

export const getSPLBalance = async (
  connection: Connection,
  mintAddress: PublicKey,
  pubKey: PublicKey,
  allowOffCurve: boolean = false
) => {
  try {
    let ata = getAssociatedTokenAddressSync(mintAddress, pubKey, allowOffCurve);
    const balance = await connection.getTokenAccountBalance(ata, "processed");
    return balance.value.uiAmount;
  } catch (e) {}
  return null;
};

export const printSPLBalance = async (
  connection: Connection,
  mintAddress: PublicKey,
  pubKey: PublicKey,
  info: string = ""
) => {
  const balance = await getSPLBalance(connection, mintAddress, pubKey);
  if (balance === null) {
    console.log(
      `${info ? info + " " : ""}${pubKey.toBase58()}:`,
      "No Account Found"
    );
  } else {
    console.log(`${info ? info + " " : ""}${pubKey.toBase58()}:`, balance);
  }
};

export const baseToValue = (base: number, decimals: number): number => {
  return base * Math.pow(10, decimals);
};

export const buildVersionedTx = async (
  connection,
  payer: PublicKey,
  tx: Transaction
): Promise<VersionedTransaction> => {
  const blockHash = (await connection.getLatestBlockhash("finalized"))
    .blockhash;

  let messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockHash,
    instructions: tx.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
};

export const getTxDetails = async (
  connection: Connection,
  sig: string
): Promise<VersionedTransactionResponse> => {
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    },
    "finalized"
  );

  return connection.getTransaction(sig, {
    maxSupportedTransactionVersion: 0,
    commitment: "finalized",
  });
};
