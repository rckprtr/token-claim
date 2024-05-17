import idl from "./token_claim.json";
import {
  PublicKey,
  Transaction,
  Connection,
  Commitment,
} from "@solana/web3.js";
import { Program, Idl, Provider } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { TokenClaimsAccount } from "./token_claims_account";
import {
  PDATokenBalanceResult,
  TokenClaimEventHandlers,
  TokenClaimEventType,
  TokenClaimedEvent,
  TokenClaimsCreatedEvent,
} from "./types";
import { toTokenClaimedEvent, toTokenClaimsCreatedEvent } from "./events";

//TODO: Token extension

export const TOKEN_CLAIMS_SEED = "token_claims";
const DEFAULT_COMMITMENT: Commitment = "confirmed";

export class TokenClaim {
  public program: Program<Idl>;
  constructor(provider?: Provider) {
    this.program = new Program(idl as Idl, provider);
  }

  addEventListener<T extends TokenClaimEventType>(
    eventType: T,
    callback: (
      event: TokenClaimEventHandlers[T],
      slot: number,
      signature: string
    ) => void
  ) {
    return this.program.addEventListener(
      eventType,
      (event: any, slot: number, signature: string) => {
        let processedEvent;
        switch (eventType) {
          case "tokenClaimedEvent":
            processedEvent = toTokenClaimedEvent(event as TokenClaimedEvent);
            callback(processedEvent, slot, signature);
            break;
          case "tokenClaimsCreatedEvent":
            processedEvent = toTokenClaimsCreatedEvent(
              event as TokenClaimsCreatedEvent
            );
            callback(processedEvent, slot, signature);
            break;
          default:
            console.error("Unhandled event type:", eventType);
        }
      }
    );
  }

  removeEventListener(eventId: number) {
    this.program.removeEventListener(eventId);
  }

  getTokenClaimPDA(campaignId: number, authority: PublicKey): PublicKey {
    let campaignIdBuffer = Buffer.alloc(8);
    campaignIdBuffer.writeBigUInt64LE(BigInt(campaignId));

    const [tokenClaimsPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_CLAIMS_SEED), campaignIdBuffer, authority.toBuffer()],
      this.program.programId
    );
    return tokenClaimsPDA;
  }

  async getCreateInstruction(
    campaignId: number,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .createTokenClaims(new BN(campaignId))
      .accounts({
        authority: authority,
        tokenClaims: this.getTokenClaimPDA(campaignId, authority),
      })
      .transaction();
  }

  async getDepositInstruction(
    connection: Connection,
    campaignId: number,
    from: PublicKey,
    authority: PublicKey,
    mintAddress: PublicKey,
    amount: number,
    programId = TOKEN_PROGRAM_ID,
  ): Promise<Transaction> {
    const mint = await getMint(connection, mintAddress);

    const tokenClaimPDA = this.getTokenClaimPDA(campaignId, authority);

    let fromAta = await getAssociatedTokenAddress(
      mintAddress, // token
      from, // owner
      false,
      programId
    );

    let receiverAta = await getAssociatedTokenAddress(
      mintAddress, // token
      tokenClaimPDA, // owner
      true,
      programId
    );

    let transaction = new Transaction();

    try {
      await getAccount(connection, receiverAta, "confirmed", programId);
    } catch (e) {
      // Create ATA on behalf of receiver
      transaction.add(
        createAssociatedTokenAccountInstruction(
          from,
          receiverAta,
          tokenClaimPDA,
          mintAddress,
          programId
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
        mint.decimals, // decimals
        [],
        programId
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
    const tokenClaimPDA = this.getTokenClaimPDA(campaignId, authority);

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

  async isTokenAccountInitialized(
    connection: Connection,
    campaignId: number,
    authority: PublicKey,
    commitment: Commitment = DEFAULT_COMMITMENT
  ) {
    const tokenClaimPDA = this.getTokenClaimPDA(campaignId, authority);
    let nameAccount = await connection.getAccountInfo(
      tokenClaimPDA,
      commitment
    );
    return nameAccount !== null;
  }

  async getTokenAccount(
    connection: Connection,
    campaignId: number,
    authority: PublicKey,
    commitment: Commitment = DEFAULT_COMMITMENT
  ) {
    const tokenClaimPDA = this.getTokenClaimPDA(campaignId, authority);
    const tokenAccount = await connection.getAccountInfo(
      tokenClaimPDA,
      commitment
    );
    if (!tokenAccount) {
      return null;
    }

    let tokenClaimAccount = TokenClaimsAccount.fromBuffer(tokenAccount?.data);
    return tokenClaimAccount;
  }

  async getPDAMintAccountBalance(
    connection: Connection,
    campaignId: number,
    authority: PublicKey,
    mintAddress: PublicKey,
  ): Promise<PDATokenBalanceResult> {
    const tokenClaimPDA = this.getTokenClaimPDA(campaignId, authority);
    const tokenClaimPDAATA = await getAssociatedTokenAddress(mintAddress, tokenClaimPDA, true);
    const tokenAccountInfo = await getAccount(
      connection,
      tokenClaimPDAATA
    );
    const mint = await getMint(connection, mintAddress);
    return {
      mint: mint,
      account: tokenAccountInfo,
    };
  }
}
