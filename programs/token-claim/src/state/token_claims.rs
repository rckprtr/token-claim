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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_claims_initialization() {
        let authority = Pubkey::new_unique();
        let bump = 255;
        let campaign_id = 12345;

        let token_claims = TokenClaims {
            authority,
            bitmap: [0; 1024],
            bump,
            campaign_id,
        };

        assert_eq!(token_claims.authority, authority);
        assert_eq!(token_claims.bitmap, [0; 1024]);
        assert_eq!(token_claims.bump, bump);
        assert_eq!(token_claims.campaign_id, campaign_id);
    }

    #[test]
    fn test_is_nonce_claimed() {
        let mut token_claims = TokenClaims {
            authority: Pubkey::new_unique(),
            bitmap: [0; 1024],
            bump: 255,
            campaign_id: 1,
        };

        assert!(!token_claims.is_nonce_claimed(0));
        assert!(!token_claims.is_nonce_claimed(7));
        assert!(!token_claims.is_nonce_claimed(8));
        assert!(!token_claims.is_nonce_claimed(1023));
        assert!(!token_claims.is_nonce_claimed(8191));

        token_claims.bitmap[0] = 1; // Set first bit
        assert!(token_claims.is_nonce_claimed(0));
        assert!(!token_claims.is_nonce_claimed(1));

        token_claims.bitmap[1] = 128; // Set 8th bit in second byte
        assert!(token_claims.is_nonce_claimed(15));
        assert!(!token_claims.is_nonce_claimed(14));
    }

    #[test]
    fn test_set_nonce_claimed() {
        let mut token_claims = TokenClaims {
            authority: Pubkey::new_unique(),
            bitmap: [0; 1024],
            bump: 255,
            campaign_id: 1,
        };

        token_claims.set_nonce_claimed(0);
        assert!(token_claims.is_nonce_claimed(0));
        assert_eq!(token_claims.bitmap[0], 1);

        token_claims.set_nonce_claimed(7);
        assert!(token_claims.is_nonce_claimed(7));
        assert_eq!(token_claims.bitmap[0], 129);

        token_claims.set_nonce_claimed(8);
        assert!(token_claims.is_nonce_claimed(8));
        assert_eq!(token_claims.bitmap[1], 1);

        token_claims.set_nonce_claimed(1023);
        assert!(token_claims.is_nonce_claimed(1023));
        assert_eq!(token_claims.bitmap[127], 128);

        token_claims.set_nonce_claimed(8191);
        assert!(token_claims.is_nonce_claimed(8191));
        assert_eq!(token_claims.bitmap[1023], 128);
    }
}