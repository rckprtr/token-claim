import { AnchorProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { TokenClaim } from "../../client";
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import {
  baseToValue,
  buildVersionedTx,
  getOrCreateKeypair,
  getSPLBalance,
  getSPLBalanceTokenAmount,
  getTxDetails,
  printSOLBalance,
  printSPLBalance,
} from "./util";
import {
  createCloseAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

const KEYS_FOLDER = __dirname + "/.keys";

//USDC Devnet Faucet: https://faucet.circle.com/
const USDC_DEVNET_ADDRESS = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const DEVNET_PROGRAM_ID = "4XEosTXqFzmpKyd7k6bd3b1RzqMAtjzHkendSLcBLFxL";

const main = async () => {
  let connection = new Connection(
    "https://devnet.helius-rpc.com/?api-key=7f79bd1c-2e04-424e-b9e4-7cde0e0a9506"
  );
  let wallet = new NodeWallet(new Keypair()); //note this is not used
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "processed",
  });

  const tokenClaim = new TokenClaim(provider);
  const campaignId = 0;

  const authorityKey = getOrCreateKeypair(KEYS_FOLDER, "authority");
  const receiverKey = getOrCreateKeypair(KEYS_FOLDER, "receiver");
  await printSOLBalance(
    connection,
    authorityKey.publicKey,
    "Authority keypair"
  );
  await printSOLBalance(connection, receiverKey.publicKey, "Receiver keypair");

  const usdcMint = await getMint(
    connection,
    new PublicKey(USDC_DEVNET_ADDRESS)
  );

  //trasfer out and close ata for receiver
  // try {
  //   let closeResponse = await transferAllUSDCAndCloseATA(
  //     connection,
  //     authorityKey,
  //     receiverKey,
  //     usdcMint.address
  //   );
  //   console.log("Close ATA response", closeResponse);
  // } catch (e) {
  //   console.error("Error closing ATA", e);
  // }
  // return;

  printSPLBalance(
    connection,
    usdcMint.address,
    authorityKey.publicKey,
    "Authority USDC balance"
  );

  let isInitialized = await tokenClaim.isTokenAccountInitialized(
    connection,
    campaignId,
    authorityKey.publicKey
  );
  if (!isInitialized) {
    try {
      let createResult = await createTokeClaim(
        connection,
        tokenClaim,
        campaignId,
        authorityKey
      );
      console.log("Create token claim result", createResult);
      //sleep 5 seconds to allow the transaction to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (e) {
      console.error("Error creating token claim", e);
    }
  }

  let pdaUSDCBalance = await getSPLBalance(
    connection,
    usdcMint.address,
    tokenClaim.getTokenClaimPDA(campaignId, authorityKey.publicKey),
    true
  );
  console.log("PDA USDC balance", pdaUSDCBalance);
  if (pdaUSDCBalance === null || pdaUSDCBalance < 1) {
    console.log("PDA USDC balance is 0, depositing 10 USDC");
    try {
      let depositResults = await depositUSCD(
        connection,
        tokenClaim,
        campaignId,
        authorityKey,
        new PublicKey(USDC_DEVNET_ADDRESS),
        baseToValue(10, usdcMint.decimals)
      );

      console.log("Deposit USDC token claim result", depositResults);

      pdaUSDCBalance = await getSPLBalance(
        connection,
        usdcMint.address,
        tokenClaim.getTokenClaimPDA(campaignId, authorityKey.publicKey),
        true
      );
      console.log("PDA USDC balance", pdaUSDCBalance);
    } catch (e) {
      console.error("Error deposit USDC", e);
    }
  }

  //claim 1 USDC
  let nonce = 0;
  let amount = baseToValue(1, usdcMint.decimals);

  //sleep 5 seconds to allow the transaction to be processed
  await new Promise((resolve) => setTimeout(resolve, 5000));
  let currentReceiverBalance = await connection.getBalance(
    receiverKey.publicKey,
    "processed"
  );
  let currentAuthorityBalance = await connection.getBalance(
    authorityKey.publicKey,
    "processed"
  );

  try {
    let claimResult = await claimUSDC(
      connection,
      tokenClaim,
      campaignId,
      authorityKey,
      usdcMint.address,
      receiverKey,
      nonce,
      amount
    );
    console.log("Claim USDC result", claimResult);

    let receiverBalance = await getSPLBalance(
      connection,
      usdcMint.address,
      receiverKey.publicKey
    );
    console.log("Receiver USDC balance", receiverBalance);
  } catch (e) {
    console.error("Error claiming USDC", e);
  }
  //sleep 5 seconds to allow the transaction to be processed
  await new Promise((resolve) => setTimeout(resolve, 5000));
  let afterBalanceReceiverBalance = await connection.getBalance(
    receiverKey.publicKey,
    "processed"
  );
  let afterBalanceAuthorityBalance = await connection.getBalance(
    authorityKey.publicKey,
    "processed"
  );
  console.log(
    "Receiver Cost",
    (currentReceiverBalance - afterBalanceReceiverBalance) / LAMPORTS_PER_SOL
  );
  console.log(
    "Authority Cost",
    (currentAuthorityBalance - afterBalanceAuthorityBalance) / LAMPORTS_PER_SOL
  );
};

async function depositUSCD(
  connection: Connection,
  tokenClaim: TokenClaim,
  campaignId: number,
  authorityKey: Keypair,
  usdcMint: PublicKey,
  amount: number
) {
  const depositTx = await tokenClaim.getDepositInstruction(
    connection,
    campaignId,
    authorityKey.publicKey,
    authorityKey.publicKey,
    usdcMint,
    amount
  );

  let depositVTx = await buildVersionedTx(
    connection,
    authorityKey.publicKey,
    depositTx
  );

  depositVTx.sign([authorityKey]);

  const depositSig = await connection.sendTransaction(depositVTx, {
    skipPreflight: true,
  });
  return getTxDetails(connection, depositSig);
}

async function createTokeClaim(
  connection: Connection,
  tokenClaim: TokenClaim,
  campaignId: number,
  authorityKey: Keypair
) {
  let createTokenClaimTx = await tokenClaim.getCreateInstruction(
    campaignId,
    authorityKey.publicKey
  );

  let createTokenClaimVTx = await buildVersionedTx(
    connection,
    authorityKey.publicKey,
    createTokenClaimTx
  );

  createTokenClaimVTx.sign([authorityKey]);

  const createSig = await connection.sendTransaction(createTokenClaimVTx, {
    skipPreflight: true,
  });

  return getTxDetails(connection, createSig);
}

async function claimUSDC(
  connection: Connection,
  tokenClaim: TokenClaim,
  campaignId: number,
  authorityKey: Keypair,
  usdcMint: PublicKey,
  receiverKey: Keypair,
  nonce: number,
  amount: number
) {
  const claimTx = await tokenClaim.getClaimInstruction(
    connection,
    campaignId,
    authorityKey.publicKey,
    usdcMint,
    receiverKey.publicKey,
    nonce,
    amount
  );

  let claimVTx = await buildVersionedTx(
    connection,
    receiverKey.publicKey,
    claimTx
  );

  claimVTx.sign([receiverKey]);
  claimVTx.sign([authorityKey]);

  const claimSig = await connection.sendTransaction(claimVTx, {
    skipPreflight: true,
  });

  return getTxDetails(connection, claimSig);
}

async function transferAllUSDCAndCloseATA(
  connection: Connection,
  authorityKey: Keypair,
  receiverKey: Keypair,
  usdcMint: PublicKey
) {
  let closeTx = new Transaction();

  let receiverAta = getAssociatedTokenAddressSync(
    usdcMint,
    receiverKey.publicKey
  );
  let authorityAta = getAssociatedTokenAddressSync(
    usdcMint,
    authorityKey.publicKey
  );

  let usdBalanceTokenAmount = await getSPLBalanceTokenAmount(
    connection,
    usdcMint,
    receiverKey.publicKey
  );
  closeTx.add(
    createTransferInstruction(
      receiverAta, // from
      authorityAta, // to
      receiverKey.publicKey, // from's owner
      Number(usdBalanceTokenAmount.value.amount) //amount
    )
  );

  closeTx.add(
    createCloseAccountInstruction(
      receiverAta,
      authorityAta,
      receiverKey.publicKey
    )
  );

  let closeVTx = await buildVersionedTx(
    connection,
    receiverKey.publicKey,
    closeTx
  );

  closeVTx.sign([receiverKey]);

  const closeSig = await connection.sendTransaction(closeVTx, {
    skipPreflight: true,
  });

  return getTxDetails(connection, closeSig);
}

main();
