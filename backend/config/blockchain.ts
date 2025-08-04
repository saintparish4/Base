import { ethers } from "ethers";
import { config } from "./environment";
import { logger } from "../utils/logger";

// ETHEREUM PROVIDER
export const ethereumProvider = new ethers.JsonRpcProvider(
  config.blockchain.ethereum
);

// POLYGON PROVIDER
export const polygonProvider = new ethers.JsonRpcProvider(
  config.blockchain.polygon
);

// WALLET SETUP
export function createWallet(privateKey?: string): ethers.Wallet {
  const key = privateKey || config.blockchain.privateKey;
  if (!key) {
    throw new Error("Private key is required for Wallet creation");
  }
  return new ethers.Wallet(key);
}

// USDC CONTRACT ABI (SIMPLIFIED FOR PAYMENTS)
export const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// GET USDC CONTRACT INSTANCE
export function getUSDCContract(
  provider: ethers.Provider,
  signerOrAddress?: ethers.Signer
) {
  return new ethers.Contract(
    config.blockchain.usdcContractAddress,
    USDC_ABI,
    signerOrAddress || provider
  );
}

// NETWORK CONFIGURATION
export const NETWORKS = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    provider: ethereumProvider,
    currency: "ETH",
    blockTime: 12000,
  },
  polygon: {
    chainId: 137,
    name: "Polygon Mainnet",
    provider: polygonProvider,
    currency: "MATIC",
    blockTime: 2000,
  },
};

// GAS ESTIMATION UTILITIES
export async function estimateGasPrice(
  provider: ethers.Provider
): Promise<bigint> {
  try {
    const gasPrice = await provider.getFeeData();
    return gasPrice.gasPrice || ethers.parseUnits("20", "gwei");
  } catch (error) {
    logger.error("Failed to estimate gas price", error);
    return ethers.parseUnits("20", "gwei"); // fallback
  }
}

export async function getOptimalNetwork(): Promise<keyof typeof NETWORKS> {
  try {
    const [ethGasPrice, polygonGasPrice] = await Promise.all([
      estimateGasPrice(ethereumProvider),
      estimateGasPrice(polygonProvider),
    ]);

    // SIMPLE LOGIC: USE POLYGON IF ETHEREUM GAS IS TOO HIGH
    const ethGasInGwei = Number(ethers.formatUnits(ethGasPrice, "gwei"));

    if (ethGasInGwei > 50) {
      logger.info(`High Ethereum gas (${ethGasInGwei} gwei), using Polygon`);
      return "polygon";
    }
    return "ethereum";
  } catch (error) {
    logger.error("Failed to determine optimal network", error);
    return "polygon"; // fallback to cheaper network
  }
}
