
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;

pub mod instructions;
pub mod state;

declare_id!("GKjhT8AoKvdvoi6X9U4cKFQo4RCFNotSwvhzDm8FwA6t");

#[program]
pub mod token_claim {
    use super::*;

    pub fn create_token_claims(ctx: Context<CreateTokenClaims>, campaign_id: u64) -> Result<()> {
        create::create_token_claims(ctx, campaign_id)
    }

    pub fn claim_token(ctx: Context<RequestClaimToken>, campaign_id: u64, nonce: u64, amount: u64) -> Result<()> {
        claim::claim_token(ctx, campaign_id, nonce, amount)
    }

    pub fn claim_status(ctx: Context<RequestClaimStatus>, campaign_id: u64, nonce: u64) -> Result<ClaimStatusResult> {
        claim_status::claim_status(ctx, campaign_id, nonce)
    }
}