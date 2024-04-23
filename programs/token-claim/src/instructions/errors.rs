use anchor_lang::error_code;


#[error_code]
pub enum TokenClaimError {
    #[msg("Nonce Claimed: Token already claimed")]
    NonceAlreadyClaimed,
    #[msg("Unauthorized: User is not the authority")]
    Unauthorized,
}