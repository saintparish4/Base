import { ethers } from "ethers";
import {
  ethereumProvider,
  polygonProvider,
  getUSDCContract,
  createWallet,
  estimateGasPrice,
  getOptimalNetwork,
  NETWORKS,
} from "../../config/blockchain";
import {
  TransactionReceipt,
  GasEstimation,
  PaymentTransaction,
} from "../../types/blockchain.types";
import { logger } from "../../utils/logger";
import { CustomError } from "../../middleware/error.middleware";

export class BlockchainService {
  private ethereumWallet: ethers.Wallet;
  private polygonWallet: ethers.Wallet;

  constructor() {
    this.ethereumWallet = createWallet().connect(ethereumProvider);
    this.polygonWallet = createWallet().connect(polygonProvider);
  }

  // GENERATE A PAYMENT ADDRESS FOR A SPECIFIC PAYMENT
  async generatePaymentAddress(paymentId: string): Promise<string> {
    try {
      // FOR MVP, USING THE MAIN WALLET ADDRESS
      // IN PRODUCTION, GENERATE A UNIQUE ADDRESSES OR USE PAYMENT DETECTION
      const network = await getOptimalNetwork();
      const wallet =
        network === "ethereum" ? this.ethereumWallet : this.polygonWallet;

      return wallet.address;
    } catch (error) {
      logger.error("Error generating payment address:", error);
      throw new CustomError("Failed to generate payment address", 500);
    }
  }

  // GET TRANSACTION DETAILS FROM BLOCKCHAIN
  async getTransactionDetails(
    hash: string,
    network: "ethereum" | "polygon"
  ): Promise<any> {
    try {
      const provider =
        network === "ethereum" ? ethereumProvider : polygonProvider;

      const [tx, receipt] = await Promise.all([
        provider.getTransaction(hash),
        provider.getTransactionReceipt(hash),
      ]);

      if (!tx || !receipt) {
        return null;
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = receipt.blockNumber
        ? currentBlock - receipt.blockNumber
        : 0;

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        amount: tx.value,
        gasUsed: receipt.gasUsed,
        gasPrice: tx.gasPrice,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        confirmations,
        status: receipt.status === 1,
      };
    } catch (error) {
      logger.error("Failed to get transaction details:", {
        hash,
        network,
        error,
      });
      return null;
    }
  }

  // ESTIMATE GAS FOR A TRANSACTION
  async estimateGas(transaction: PaymentTransaction): Promise<GasEstimation> {
    try {
      const provider =
        transaction.network === "ethereum" ? ethereumProvider : polygonProvider;
      const wallet =
        transaction.network === "ethereum"
          ? this.ethereumWallet
          : this.polygonWallet;

      const gasPrice = await estimateGasPrice(provider);
      const gasLimit = await provider.estimateGas({
        to: transaction.to,
        value: ethers.parseUnits(transaction.amount, 6),
        from: wallet.address,
      });

      const estimatedCost = gasPrice * gasLimit;

      return {
        gasPrice: Number(gasPrice),
        gasLimit: Number(gasLimit),
        estimatedCost: ethers.formatEther(estimatedCost),
        network: transaction.network,
      };
    } catch (error) {
      logger.error("Failed to estimate gas:", error);
      throw new CustomError("Failed to estimate transaction cost", 500);
    }
  }

  // SEND USDC TOKENS
  async sendUSDC(
    toAddress: string,
    amount: string,
    network: "ethereum" | "polygon" = "polygon"
  ): Promise<string> {
    try {
      const wallet =
        network === "ethereum" ? this.ethereumWallet : this.polygonWallet;
      const provider = wallet.provider;
      const usdcContract = getUSDCContract(provider!, wallet);

      const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals

      // CHECK BALANCE
      const balance = await usdcContract.balanceOf(wallet.address);
      if (balance < amountWei) {
        throw new CustomError("Insufficient balance", 400);
      }

      // SEND TRANSACTION
      const tx = await usdcContract.transfer(toAddress, amountWei, {
        gasLimit: 100000, // SAFE GAS LIMIT FOR USDC TRANSFERS
      });

      logger.info("USDC transfer initiated:", {
        hash: tx.hash,
        to: toAddress,
        amount,
        network,
      });

      return tx.hash;
    } catch (error) {
      logger.error("Failed to send USDC:", error);
      throw new CustomError("Failed to send USDC", 500);
    }
  }

  // CHECK USDC BALANCE
  async getUSDCBalance(
    address: string,
    network: "ethereum" | "polygon" = "polygon"
  ): Promise<string> {
    try {
      const provider =
        network === "ethereum" ? ethereumProvider : polygonProvider;
      const usdcContract = getUSDCContract(provider);

      const balance = await usdcContract.balanceOf(address);
      return ethers.formatUnits(balance, 6);
    } catch (error) {
      logger.error("Failed to get USDC balance:", error);
      throw new CustomError("Failed to get USDC balance", 500);
    }
  }

  // MONITOR PENDING TRANSACTION FOR CONFIRMATIONS
  async monitorTransaction(
    hash: string,
    network: "ethereum" | "polygon" = "polygon"
  ): Promise<void> {
    try {
      const provider =
        network === "ethereum" ? ethereumProvider : polygonProvider;
      const requiredConfirmations = network === "ethereum" ? 3 : 10;

      logger.info("Starting transaction monitoring:", { hash, network });

      // WAIT FOR TRANSACTION TO BE MINED
      const receipt = await provider.waitForTransaction(
        hash,
        requiredConfirmations
      );

      if (receipt) {
        logger.info("Transaction confirmed:", {
          hash,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations,
        });

        // UPDATE THE TRANSACTION STATUS IN THE DATABASE
        // AND TRIGGER PAYMENT COMPLETION LOGIC
      }
    } catch (error) {
      logger.error("Transaction monitoring failed:", { hash, error });
    }
  }

  // GET NETWORK STATUS
  async getNetworkStatus(network: "ethereum" | "polygon"): Promise<{
    isHealthy: boolean;
    blockNumber: number;
    gasPrice: string;
    avgBlockTime: number;
  }> {
    try {
      const provider =
        network === "ethereum" ? ethereumProvider : polygonProvider;
      const networkConfig = NETWORKS[network];

      const [blockNumber, gasPrice] = await Promise.all([
        provider.getBlockNumber(),
        estimateGasPrice(provider),
      ]);

      return {
        isHealthy: true,
        blockNumber,
        gasPrice: ethers.formatUnits(gasPrice, "gwei"),
        avgBlockTime: networkConfig.blockTime,
      };
    } catch (error) {
      logger.error("Failed to get network status:", { network, error });
      return {
        isHealthy: false,
        blockNumber: 0,
        gasPrice: "0",
        avgBlockTime: 0,
      };
    }
  }

  // VALIDATE ETHEREUM ADDRESS
  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  // GET TRANSACTION HISTORY FOR AN ADDRESS
  async getTransactionHistory(
    address: string,
    network: "ethereum" | "polygon",
    fromBlock: number = 0
  ): Promise<any[]> {
    try {
      const provider =
        network === "ethereum" ? ethereumProvider : polygonProvider;
      const usdcContract = getUSDCContract(provider);

      // GET TRANSFER EVENTS FOR THE ADDRESS
      const filter = usdcContract.filters.Transfer(null, address);
      const events = await usdcContract.queryFilter(filter, fromBlock);

      return events
        .map((event) => {
          // Type guard to ensure event has args property
          if ("args" in event && event.args) {
            return {
              hash: event.transactionHash,
              blockNumber: event.blockNumber,
              from: event.args[0],
              to: event.args[1],
              amount: ethers.formatUnits(event.args[2], 6),
            };
          }
          return null;
        })
        .filter(Boolean);
    } catch (error) {
      logger.error("Failed to get transaction history:", error);
      return [];
    }
  }
}
