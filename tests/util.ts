import * as anchor from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";


type CostTrackerItem = {
  text: string;
  balance: number;
};

export class CostTracker {
  private costsTracker: Record<string, CostTrackerItem[]> = {};
  private connection: anchor.web3.Connection;

  constructor(connection: anchor.web3.Connection) {
    this.connection = connection;
  }

  public async track(text: string, pubKey: anchor.web3.PublicKey) {
    if (!this.costsTracker[pubKey.toString()]) {
      this.costsTracker[pubKey.toString()] = [];
    }

    const balance = await this.connection.getBalance(pubKey);
    this.costsTracker[pubKey.toString()].push({ text, balance });
  }

  public logBalances() {
    for (const key in this.costsTracker) {
      let previousBalance = null;
      let totalCosts = 0;
      for (const item of this.costsTracker[key]) {
        if (previousBalance) {
          let diff = previousBalance - item.balance;
          console.log(`${key}: ${item.text}: ${diff / LAMPORTS_PER_SOL} SOL`);
          totalCosts += diff;
        }
        previousBalance = item.balance;
      }
      console.log(`${key}: Total costs: ${totalCosts / LAMPORTS_PER_SOL} SOL`);
    }
  }
}
