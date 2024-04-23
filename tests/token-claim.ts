import * as anchor from "@coral-xyz/anchor";
import { TokenClaim } from "../target/types/token_claim";
import {
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
} from "@solana/web3.js";
import { assert } from "chai";
import * as borsh from "borsh";
import { CostTracker } from "./util";
import { ClaimStatusResult } from "../client/types";
import { TokenClaim as TokenClaimClient } from "../client";

type TokenClaimSetup = {
  mint: PublicKey;
};

function convertToClaimStatusResult(claimStatus: number): ClaimStatusResult {
  return claimStatus === 0
    ? ClaimStatusResult.Claimed
    : ClaimStatusResult.Unclaimed;
}

const getReturnLog = (confirmedTransaction) => {
  const prefix = "Program return: ";
  let log = confirmedTransaction.meta.logMessages.find((log) =>
    log.startsWith(prefix)
  );
  log = log.slice(prefix.length);
  const [key, data] = log.split(" ", 2);
  const buffer = Buffer.from(data, "base64");
  return [key, data, buffer];
};

const buildVersionedTx = async (
  connection,
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

const getTxDetails = async (provider, sig) => {
  const connection = provider.connection;
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    },
    "confirmed"
  );

  return await provider.connection.getTransaction(sig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
};

describe("PDAs", async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.TokenClaim as anchor.Program<TokenClaim>;

  const receiver = anchor.web3.Keypair.generate();
  const authority = anchor.web3.Keypair.generate();

  const campaignId = 0;

  const tokenClaim = new TokenClaimClient();
  const tokenClaimsPDA = tokenClaim.createTokenClaimPDA(campaignId, authority.publicKey);

  const costTracker = new CostTracker(provider.connection);


  before(async () => {
    let sig = await provider.connection.requestAirdrop(
      receiver.publicKey,
      LAMPORTS_PER_SOL
    );

    await getTxDetails(provider, sig);

    sig = await provider.connection.requestAirdrop(
      authority.publicKey,
      LAMPORTS_PER_SOL * 5
    );

    await getTxDetails(provider, sig);
  });

  const setup = async (): Promise<TokenClaimSetup> => {
    const mint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6
    );

    const tokensClaimPDAAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      mint,
      tokenClaimsPDA,
      true
    );

    await mintTo(
      provider.connection,
      payer.payer,
      mint,
      tokensClaimPDAAta.address,
      payer.payer,
      100
    );

    return {
      mint
    };
  };

  it("Create the token claim PDA", async () => {
    costTracker.track("pre authority create", authority.publicKey);

    const createTokenClaimTx = await tokenClaim.getCreateInstruction(
      campaignId,
      authority.publicKey
    );

    let versionedTx = await buildVersionedTx(
      provider.connection,
      authority.publicKey,
      createTokenClaimTx
    );

    versionedTx.sign([authority]);

    let sig = await provider.connection.sendTransaction(versionedTx);
    await getTxDetails(provider, sig);

    await costTracker.track("post authority create", authority.publicKey);
  });

  it("Claims token and try reclaim", async () => {
    costTracker.track("pre receiver claim", receiver.publicKey);
    costTracker.track("pre authority claim", authority.publicKey);

    let setupResult = await setup();

    const createTokenClaimTx = await tokenClaim.getClaimInstruction(
      provider.connection,
      campaignId,
      authority.publicKey,
      setupResult.mint,
      receiver.publicKey,
      0,
      1
    );

    let versionedTx = await buildVersionedTx(
      provider.connection,
      receiver.publicKey,
      createTokenClaimTx
    );
    versionedTx.sign([receiver, authority]);

    let sig = await provider.connection.sendTransaction(versionedTx, {
      skipPreflight: true,
    });
    await getTxDetails(provider, sig);

    costTracker.track("post authority claim", authority.publicKey);
    costTracker.track("post receiver claim", receiver.publicKey);

    try {
      const createTokenClaimTx = await tokenClaim.getClaimInstruction(
        provider.connection,
        campaignId,
        authority.publicKey,
        setupResult.mint,
        receiver.publicKey,
        0,
        1
      );

      let versionedTx = await buildVersionedTx(
        provider.connection,
        receiver.publicKey,
        createTokenClaimTx
      );
      versionedTx.sign([receiver, authority]);

      let sig = await provider.connection.sendTransaction(versionedTx, {
        skipPreflight: true,
      });

      await getTxDetails(provider, sig);
    } catch (_err) {
      console.log(_err);
      const err: anchor.ProgramError = _err;
      assert.strictEqual(err.msg, "Nonce Claimed: Token already claimed");
      assert.strictEqual(err.code, 6000);
    }
  });

  it("Should have claimed status Claimed", async () => {
    const tx = await program.methods
      .claimStatus(new anchor.BN(campaignId), new anchor.BN(0))
      .accounts({
        authority: authority.publicKey,
        tokenClaims: tokenClaimsPDA,
      })
      .rpc();

    const txDetails = await getTxDetails(provider, tx);

    let [key, data, buffer] = getReturnLog(txDetails);
    const reader = new borsh.BinaryReader(buffer).readU8();
    let status = convertToClaimStatusResult(reader);
    assert.strictEqual(status, ClaimStatusResult.Claimed);
  });

  it("Should have claimed status Unclaimed", async () => {
    const tx = await program.methods
      .claimStatus(new anchor.BN(campaignId), new anchor.BN(1))
      .accounts({
        authority: authority.publicKey,
        tokenClaims: tokenClaimsPDA,
      })
      .rpc();

    const txDetails = await getTxDetails(provider, tx);

    let [key, data, buffer] = getReturnLog(txDetails);
    const reader = new borsh.BinaryReader(buffer).readU8();
    let status = convertToClaimStatusResult(reader);
    assert.strictEqual(status, ClaimStatusResult.Unclaimed);
  });

  after(() => {
    costTracker.logBalances();
  });
});
