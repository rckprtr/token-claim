
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;

pub mod instructions;
pub mod state;

declare_id!("GKjhT8AoKvdvoi6X9U4cKFQo4RCFNotSwvhzDm8FwA6t");

#[program]
pub mod token_claim {
    use super::*;

    pub fn create_token_claims(ctx: Context<CreateTokenClaims>) -> Result<()> {
        create::create_token_claims(ctx)
    }

    pub fn claim_token(ctx: Context<RequestClaimToken>, nonce: u64, amount: u64) -> Result<()> {
        claim::claim_token(ctx, nonce, amount)
    }

    pub fn claim_status(ctx: Context<RequestClaimStatus>, nonce: u64) -> Result<ClaimStatusResult> {
        claim_status::claim_status(ctx, nonce)
    }
}
