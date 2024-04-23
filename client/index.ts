import idl from "./token_claim.json";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { Program, Idl } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { BN } from "bn.js";

export const TOKEN_CLAIMS_SEED = "token_claims";

export class TokenClaim {
  public program: Program<Idl>;
  constructor() {
    this.program = new Program(idl as Idl);
  }

  createTokenClaimPDA(campaignId: number, authority: PublicKey): PublicKey {

    let campaignIdBuffer = Buffer.alloc(8);
    campaignIdBuffer.writeBigUInt64LE(BigInt(campaignId));

    const [tokenClaimsPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_CLAIMS_SEED), 
        campaignIdBuffer,
        authority.toBuffer()
      ],
      this.program.programId
    );
    return tokenClaimsPDA;
  }

  async getCreateInstruction(campaignId: number, authority: PublicKey): Promise<Transaction> {
    return await this.program.methods
      .createTokenClaims(new BN(campaignId))
      .accounts({
        authority: authority,
        tokenClaims: this.createTokenClaimPDA(campaignId, authority),
      })
      .transaction();
  }

  async getDepositInstruction(
    connection: Connection,
    campaignId: number,
    from: PublicKey,
    authority: PublicKey,
    mintAddress: PublicKey,
    amount: number
  ): Promise<Transaction> {
    const mint = await getMint(connection, mintAddress);

    const tokenClaimPDA = this.createTokenClaimPDA(campaignId, authority);

    let fromAta = await getAssociatedTokenAddress(
      mintAddress, // token
      from // owner
    );

    let receiverAta = await getAssociatedTokenAddress(
      mintAddress, // token
      tokenClaimPDA // owner
    );

    let transaction = new Transaction();

    try {
      await getAccount(connection, receiverAta);
    } catch (e) {
      // Create ATA on behalf of receiver
      transaction.add(
        createAssociatedTokenAccountInstruction(
          from,
          receiverAta,
          tokenClaimPDA,
          mintAddress
        )
      );
    }

    transaction.add(
      createTransferCheckedInstruction(
        fromAta, // from
        mint.address, // mint
        receiverAta, // to
        from, // from's owner
        amount, //amount
        mint.decimals // decimals
      )
    );
    return transaction;
  }

  async getClaimInstruction(
    connection: Connection,
    campaignId: number,
    authority: PublicKey,
    mintAddress: PublicKey,
    receiver: PublicKey,
    nonce: number,
    amount: number
  ): Promise<Transaction> {
    const tokenClaimPDA = this.createTokenClaimPDA(campaignId, authority);

    const receiverAta = await getAssociatedTokenAddress(mintAddress, receiver);

    let tokenClaimPDAAta = await getAssociatedTokenAddress(
      mintAddress,
      tokenClaimPDA,
      true
    );

    let transaction = new Transaction();

    try {
      await getAccount(connection, receiverAta);
    } catch (e) {
      // Create ATA on behalf of receiver
      transaction.add(
        createAssociatedTokenAccountInstruction(
          receiver,
          receiverAta,
          receiver,
          mintAddress
        )
      );
    }

    transaction.add(
      await this.program.methods
        .claimToken(new BN(campaignId), new BN(nonce), new BN(amount))
        .accounts({
          authority: authority,
          receiver: receiver,
          tokenClaims: tokenClaimPDA,
          mint: mintAddress,
          tokenClaimsTokenAccount: tokenClaimPDAAta,
          receiverTokenAccount: receiverAta,
        })
        .transaction()
    );

    return transaction;
  }
}
