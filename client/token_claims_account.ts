import { PublicKey } from "@solana/web3.js";
import { struct, u8, u64, publicKey, Layout } from "@coral-xyz/borsh";
import * as bufferLayout from "buffer-layout";

export class TokenClaimsAccount {
  public discriminator: bigint;
  public authority: PublicKey;
  public bitmap: Uint8Array;
  public bump: number;
  public campaignId: bigint;

  constructor(
    discriminator: bigint,
    authority: PublicKey,
    bitmap: Uint8Array,
    bump: number,
    campaignId: bigint
  ) {
    this.discriminator = discriminator;
    this.authority = authority;
    this.bitmap = bitmap;
    this.bump = bump;
    this.campaignId = campaignId;
  }

  isNonceClaimed(nonce: number): boolean {
    const index = Math.floor(nonce / 8);
    const mask = 1 << nonce % 8;
    return (this.bitmap[index] & mask) !== 0;
  }

  static fromBuffer(buffer: Buffer): TokenClaimsAccount {
    const structure: Layout<TokenClaimsAccount> = struct([
      u64("discriminator"),
      publicKey("authority"),
      bufferLayout.blob(1024, "bitmap"),
      u8("bump"),
      u64("campaignId"),
    ]);

    let value = structure.decode(buffer);

    return new TokenClaimsAccount(
      BigInt(value.discriminator),
      value.authority,
      Uint8Array.from(value.bitmap),
      Number(value.bump),
      BigInt(value.campaignId)
    );
  }
}