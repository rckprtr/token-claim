use crate::{state::TokenClaims, TokenClaimError};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct RequestClaimToken<'info> {
    authority: Signer<'info>,

    receiver: Signer<'info>,

    #[account(
        mut,
        seeds = [
            TokenClaims::SEED_PREFIX,
            campaign_id.to_le_bytes().as_ref(),
            authority.key().as_ref(),
        ],
        bump = token_claims.bump,
    )]
    token_claims: Account<'info, TokenClaims>,

    mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = token_claims,
    )]
    pub token_claims_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = receiver,
    )]
    pub receiver_token_account: Box<Account<'info, TokenAccount>>,

    /// Solana ecosystem accounts
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn claim_token(ctx: Context<RequestClaimToken>, campaign_id: u64, nonce: u64, amount: u64) -> Result<()> {

    if ctx.accounts.token_claims.authority != *ctx.accounts.authority.key {
        return Err(TokenClaimError::Unauthorized.into());
    }

    let token_claims = &mut ctx.accounts.token_claims;
    if token_claims.is_nonce_claimed(nonce) {
        return Err(TokenClaimError::NonceAlreadyClaimed.into());
    }

    token_claims.set_nonce_claimed(nonce);

    let campaign_id_bytes = campaign_id.to_le_bytes();

    let signer_seeds: [&[&[u8]]; 1] = [&[
        TokenClaims::SEED_PREFIX,
        campaign_id_bytes.as_ref(),
        &ctx.accounts.authority.key().to_bytes(),
        &[ctx.accounts.token_claims.bump],
    ]];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.token_claims_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
                authority: ctx.accounts.token_claims.to_account_info(),
            },
            &signer_seeds
        ),
        amount,
        ctx.accounts.mint.decimals
    )?;

    Ok(())
}
