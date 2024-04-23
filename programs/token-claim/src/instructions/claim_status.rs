use crate::state::TokenClaims;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum ClaimStatusResult {
    Claimed,
    Unclaimed
}

#[derive(Accounts)]
pub struct RequestClaimStatus<'info> {
    authority: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [
            TokenClaims::SEED_PREFIX,
            authority.key().as_ref(),
        ],
        bump = token_claims.bump,
    )]
    token_claims: Account<'info, TokenClaims>,
}

pub fn claim_status(_ctx: Context<RequestClaimStatus>, nonce: u64) -> Result<ClaimStatusResult> {
    let token_claims = &mut _ctx.accounts.token_claims;
    if token_claims.is_nonce_claimed(nonce) {
        Ok(ClaimStatusResult::Claimed)
    } else {
        Ok(ClaimStatusResult::Unclaimed)
    }
}