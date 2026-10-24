export interface Transaction {
    _id: string;
    userId: string;
    amount: number;
    category: string | null;
    merchant: string | null;
    name: string | null;
    type: 'credit' | 'debit';
    isSuspicious: boolean;
    timestamp: string;
}
