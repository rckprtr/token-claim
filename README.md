


# Setup

```
npm i
npm run anchor:test
```

You may also need Anchor and Yarn


# Init Anchor IDL


```
anchor idl init --filepath client/token_claim.json aiqoZjBUJu4UthkVzrijLEzSnQphe4TsuExVe5TrTbT --provider.cluster devnet
```


# Upgrading Devnet

First I had to increase the size of the program
```
solana program extend aiqoZjBUJu4UthkVzrijLEzSnQphe4TsuExVe5TrTbT 20000 -u d -k ./secret_test_extend.json
```

Next I upgraded the program
```
anchor upgrade target/deploy/token_claim.so --program-id aiqoZjBUJu4UthkVzrijLEzSnQphe4TsuExVe5TrTbT --provider.cluster devnet
```

Update Anchor IDL
```
anchor idl upgrade --filepath client/token_claim.json aiqoZjBUJu4UthkVzrijLEzSnQphe4TsuExVe5TrTbT --provider.cluster devnet
```