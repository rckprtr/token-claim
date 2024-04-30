use anchor_lang::prelude::*;


#[account]
#[derive(InitSpace)] // automatically calculate the space required for the struct
pub struct TokenClaims {
    pub authority: Pubkey,
    pub bitmap: [u8; 1024],
    pub bump: u8,
    pub campaign_id: u64,
}

impl TokenClaims {
    pub const SEED_PREFIX: &'static [u8; 12] = b"token_claims";

    pub fn is_nonce_claimed(&self, nonce: u64) -> bool {
        let index = nonce / 8;
        let bit = nonce % 8;
        self.bitmap[index as usize] & (1 << bit) != 0
    }

    pub fn set_nonce_claimed(&mut self, nonce: u64) {
        let index = nonce / 8;
        let bit = nonce % 8;
        self.bitmap[index as usize] |= 1 << bit;
    }
}