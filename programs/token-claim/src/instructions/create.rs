use crate::state::TokenClaims;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateTokenClaims<'info> {
    #[account(mut)]
    authority: Signer<'info>,

    #[account(
        init,
        space = 8 + TokenClaims::INIT_SPACE,
        payer = authority,
        seeds = [
            TokenClaims::SEED_PREFIX,
            campaign_id.to_le_bytes().as_ref(),
            authority.key().as_ref(),
        ],
        bump,
    )]
    token_claims: Box<Account<'info, TokenClaims>>,
    system_program: Program<'info, System>,
}

pub fn create_token_claims(ctx: Context<CreateTokenClaims>, campaign_id: u64) -> Result<()> {
    let token_claims = &mut ctx.accounts.token_claims;
    token_claims.authority = *ctx.accounts.authority.key;
    token_claims.bitmap = [0; 1024];
    token_claims.bump = ctx.bumps.token_claims;
    token_claims.campaign_id = campaign_id;
    
    Ok(())
}