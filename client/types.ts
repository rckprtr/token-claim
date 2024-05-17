import { Account, Mint } from "@solana/spl-token";
import {
  PublicKey,
} from "@solana/web3.js";
// import {
//   Serializer,
//   publicKey,
//   struct,
//   u8,
//   u64,
//   bytes,
// } from "@metaplex-foundation/umi/serializers";

export enum ClaimStatusResult {
  Claimed,
  Unclaimed,
}

export type PDATokenBalanceResult = {
  mint: Mint;
  account: Account;
};

export type TokenClaimsCreatedEvent = {
  authority: PublicKey;
  campaignId: number | bigint;
};

export type TokenClaimedEvent = {
  authority: PublicKey;
  mint: PublicKey;
  campaignId: number | bigint;
  nonce: number;
  amount: number | bigint;
};

export interface TokenClaimEventHandlers {
  tokenClaimsCreatedEvent: TokenClaimsCreatedEvent;
  tokenClaimedEvent: TokenClaimedEvent;
}

export type TokenClaimEventType = keyof TokenClaimEventHandlers;

// export type TokenClaimAccount = {
//   discriminator: number | bigint;
//   authority: PublicKey;
//   bitmap: Uint8Array;
//   bump: number;
//   campaignId: number | bigint;
// };

// export function getTokenClaimAccountSerializer(): Serializer<TokenClaimAccount> {
//   return struct<TokenClaimAccount>([
//     ["discriminator", u64()],
//     ["authority", publicKey()],
//     ["bitmap", bytes({ size: 1024 })],
//     ["bump", u8()],
//     ["campaignId", u64()],
//   ]) as Serializer<TokenClaimAccount>;
// }
