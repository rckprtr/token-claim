import * as anchor from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { CostTracker, buildVersionedTx, getTxDetails, setupMint } from "./util";
import { TokenClaim as TokenClaimClient } from "../client";

describe("PDAs", async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  console.log("Payer", payer.publicKey.toString());

  const receiver = anchor.web3.Keypair.generate();
  const authority = anchor.web3.Keypair.generate();

  const campaignId = 23;
  const claimNonce = 899;
  const highestNonce = 1023 * 8;

  const tokenClaim = new TokenClaimClient();
  const tokenClaimsPDA = tokenClaim.getTokenClaimPDA(
    campaignId,
    authority.publicKey
  );

  const costTracker = new CostTracker(provider.connection);

  before(async () => {
    let sig = await provider.connection.requestAirdrop(
      receiver.publicKey,
      LAMPORTS_PER_SOL
    );

    await getTxDetails(provider.connection, sig);

    sig = await provider.connection.requestAirdrop(
      authority.publicKey,
      LAMPORTS_PER_SOL * 5
    );

    await getTxDetails(provider.connection, sig);
  });

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
    await getTxDetails(provider.connection, sig);

    await costTracker.track("post authority create", authority.publicKey);
  });

  it("Claims token and try reclaim", async () => {
    let setupResult = await setupMint(
      provider.connection,
      tokenClaimsPDA,
      authority,
      payer.payer
    );

    costTracker.track("pre receiver claim", receiver.publicKey);
    costTracker.track("pre authority claim", authority.publicKey);

    const createTokenClaimTx = await tokenClaim.getClaimInstruction(
      provider.connection,
      campaignId,
      authority.publicKey,
      setupResult.mint,
      receiver.publicKey,
      claimNonce,
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
    await getTxDetails(provider.connection, sig);

    costTracker.track("post authority claim", authority.publicKey);
    costTracker.track("post receiver claim", receiver.publicKey);

    try {
      const createTokenClaimTx = await tokenClaim.getClaimInstruction(
        provider.connection,
        campaignId,
        authority.publicKey,
        setupResult.mint,
        receiver.publicKey,
        claimNonce,
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

      await getTxDetails(provider.connection, sig);
    } catch (_err) {
      console.log(_err);
      const err: anchor.ProgramError = _err;
      assert.strictEqual(err.msg, "Nonce Claimed: Token already claimed");
      assert.strictEqual(err.code, 6000);
    }

    const createTokenClaimHighestTx = await tokenClaim.getClaimInstruction(
      provider.connection,
      campaignId,
      authority.publicKey,
      setupResult.mint,
      receiver.publicKey,
      highestNonce,
      1
    );

    let versionedHighestTx = await buildVersionedTx(
      provider.connection,
      receiver.publicKey,
      createTokenClaimHighestTx
    );
    versionedHighestTx.sign([receiver, authority]);

    let sigHighest = await provider.connection.sendTransaction(
      versionedHighestTx,
      {
        skipPreflight: true,
      }
    );
    await getTxDetails(provider.connection, sigHighest);

    const tokenClaimAccount = await tokenClaim.getTokenAccount(
      provider.connection,
      campaignId,
      authority.publicKey
    );

    if (tokenClaimAccount === null) {
      assert.fail(`Token claim account not found at nonce ${highestNonce}`);
    } else {
      assert.strictEqual(
        tokenClaimAccount.isNonceClaimed(highestNonce),
        true,
        `Nonce ${highestNonce} not claimed`
      );
    }
  });

  //Full test - uncomment to run, takes awhile
  // it("Claims a token under all nonces", async () => {
  //   const fullClaimCampaignId = 24;

  //   const allTokenClaimsPDA = tokenClaim.getTokenClaimPDA(
  //     fullClaimCampaignId,
  //     authority.publicKey
  //   );
  //   let setupResult = await setupMint(
  //     provider.connection,
  //     allTokenClaimsPDA,
  //     authority,
  //     payer.payer
  //   );

  //   let createTokenClaimAccountTx = await tokenClaim.getCreateInstruction(
  //     fullClaimCampaignId,
  //     authority.publicKey
  //   );

  //   let versionedCreateTx = await buildVersionedTx(
  //     provider.connection,
  //     authority.publicKey,
  //     createTokenClaimAccountTx
  //   );

  //   versionedCreateTx.sign([authority]);

  //   let sigCreate = await provider.connection.sendTransaction(
  //     versionedCreateTx
  //   );
  //   await getTxDetails(provider.connection, sigCreate);

  //   for (let i = 0; i < highestNonce; i++) {
  //     const createTokenClaimTx = await tokenClaim.getClaimInstruction(
  //       provider.connection,
  //       fullClaimCampaignId,
  //       authority.publicKey,
  //       setupResult.mint,
  //       receiver.publicKey,
  //       i,
  //       1
  //     );

  //     let versionedTx = await buildVersionedTx(
  //       provider.connection,
  //       receiver.publicKey,
  //       createTokenClaimTx
  //     );
  //     versionedTx.sign([receiver, authority]);

  //     let sig = await provider.connection.sendTransaction(versionedTx, {
  //       skipPreflight: true,
  //     });
  //     await getTxDetails(provider.connection, sig);

  //     const tokenClaimAccount = await tokenClaim.getTokenAccount(
  //       provider.connection,
  //       fullClaimCampaignId,
  //       authority.publicKey
  //     );

  //     if (tokenClaimAccount === null) {
  //       assert.fail(`Token claim account not found at nonce ${i}`);
  //     } else {
  //       assert.strictEqual(
  //         tokenClaimAccount.isNonceClaimed(i),
  //         true,
  //         `Nonce ${i} not claimed`
  //       );
  //     }
  //     console.log(`Nonce ${i} claimed`);
  //   }
  // });

  it("Deserializes account data", async () => {
    const tokenClaimAccount = await tokenClaim.getTokenAccount(
      provider.connection,
      campaignId,
      authority.publicKey
    );

    if (tokenClaimAccount === null) {
      assert.fail("Token claim account not found");
    } else {
      assert.strictEqual(
        tokenClaimAccount.authority.toString(),
        authority.publicKey.toString()
      );
      assert.strictEqual(tokenClaimAccount.campaignId, BigInt(campaignId));
      assert.strictEqual(tokenClaimAccount.bitmap.length, 1024);
      assert.strictEqual(tokenClaimAccount.isNonceClaimed(claimNonce), true);
    }
  });

  after(() => {
    costTracker.logBalances();
  });
});
