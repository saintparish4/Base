export interface BlockchainNetwork {
    chainId: number;
    name: string;
    currency: string;
    rpcUrl: string;
    blockExplorerUrl: string;
    usdcAddress: string;
    confirmationsRequired: number; 
}

export interface GasEstimation {
    gasPrice: number;
    gasLimit: number;
    estimatedCost: string;
    network: 'ethereum' | 'polygon'; 
}

export interface PaymentTransaction {
    to: string;
    amount: string;
    network: 'ethereum' | 'polygon';
    gasPrice?: number;
    gasLimit?: number; 
}

export interface TransactionReceipt {
    hash: string;
    blockNumber: number;
    blockHash: string;
    gasUsed: number;
    status: boolean;
    confirmations: number; 
}

