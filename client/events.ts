import { TokenClaimedEvent, TokenClaimsCreatedEvent } from "./types";
import { PublicKey } from "@solana/web3.js";


export function toTokenClaimsCreatedEvent(
  event: TokenClaimsCreatedEvent
): TokenClaimsCreatedEvent {
  return {
    authority: new PublicKey(event.authority.toString()),
    campaignId: BigInt(event.campaignId),
  };
}

export function toTokenClaimedEvent(
  event: TokenClaimedEvent
): TokenClaimedEvent {
  return {
    authority: new PublicKey(event.authority.toString()),
    mint: new PublicKey(event.mint.toString()),
    campaignId: BigInt(event.campaignId),
    nonce: Number(event.nonce),
    amount: BigInt(event.amount),
  };
}