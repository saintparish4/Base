import { logger } from "../../utils/logger";

export interface FeeCalculation {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  feeRate: number;
  feeStructure: {
    base: number;
    percentage: number;
  };
}

export class FeeService {
  // STANDARD FEE RATES (can be customized per merchant)
  private static readonly DEFAULT_FEE_RATE = 0.015; //1.5%
  private static readonly MIN_FEE = 0.3; // $0.30 minimum fee
  private static readonly MAX_FEE_RATE = 0.05; // 5% maximum

  // CALCULATE FEES FOR A PAYMENT
  static calculatePaymentFee(
    amount: number,
    merchantFeeRate?: number
  ): FeeCalculation {
    const feeRate = merchantFeeRate || this.DEFAULT_FEE_RATE;

    // VALIDATE FEE RATE
    if (feeRate < 0 || feeRate > this.MAX_FEE_RATE) {
      throw new Error("Invalid fee rate");
    }

    // CALCULATE PERCENTAGE-BASED FEE
    let feeAmount = amount * feeRate;

    // APPLY MINIMUM FEE
    if (feeAmount < this.MIN_FEE) {
      feeAmount = this.MIN_FEE;
    }

    const netAmount = amount - feeAmount;

    return {
      grossAmount: amount,
      feeAmount: Math.round(feeAmount * 100) / 100, // Round to 2 decimal places
      netAmount: Math.round(netAmount * 100) / 100,
      feeRate,
      feeStructure: {
        base: this.MIN_FEE,
        percentage: feeRate,
      },
    };
  }

  // CALCULATE COST COMPARISON WITH TRADITIONAL PROCESSORS
  static calculateSavings(
    amount: number,
    cryptoFeeRate: number = this.DEFAULT_FEE_RATE
  ): {
    cryptoFee: number;
    visaFee: number;
    mastercardFee: number;
    savings: {
      vsVisa: number;
      vsMastercard: number;
    };
  } {
    // TYPICAL TRAIDTIONAL PROCESSOR FEES
    const visaFeeRate = 0.029; // 2.9%
    const mastercardFeeRate = 0.031; // 3.1%

    const cryptoFee = amount * cryptoFeeRate;
    const visaFee = amount * visaFeeRate;
    const mastercardFee = amount * mastercardFeeRate;

    return {
      cryptoFee: Math.round(cryptoFee * 100) / 100,
      visaFee: Math.round(visaFee * 100) / 100,
      mastercardFee: Math.round(mastercardFee * 100) / 100,
      savings: {
        vsVisa: Math.round((visaFee - cryptoFee) * 100) / 100,
        vsMastercard: Math.round((mastercardFee - cryptoFee) * 100) / 100,
      },
    };
  }

  // GET FEE ESTIMATE FOR DIFFERENT PAYMENT AMOUNTS
  static getFeeEstimates(
    amounts: number[],
    feeRate: number = this.DEFAULT_FEE_RATE
  ): Array<{
    amount: number;
    fee: number;
    net: number;
    savingsVsVisa: number;
  }> {
    return amounts.map((amount) => {
      const feeCalc = this.calculatePaymentFee(amount, feeRate);
      const savings = this.calculateSavings(amount, feeRate);

      return {
        amount,
        fee: feeCalc.feeAmount,
        net: feeCalc.netAmount,
        savingsVsVisa: savings.savings.vsVisa,
      };
    });
  }
}
