import { PublicKey } from "@solana/web3.js";

export enum ClaimStatusResult {
  Claimed,
  Unclaimed,
}

export type TokenClaimAccount = {
  authority: PublicKey;
  bitmap: Uint8Array;
  bump: number;
  campaignId: number;
};
