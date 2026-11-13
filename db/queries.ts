import { SQLiteDatabase } from 'expo-sqlite';
import { Category } from '@/constants/categories';

export interface Wallet {
  id: string;
  name: string;
  current_balance: number;
  icon: string;
  created_at: number;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string | null;
  receipt_path: string | null;
  date: number;
}

export interface TransactionWithWallet extends Transaction {
  wallet_name: string;
  wallet_icon: string;
}

export interface CategorySummary {
  category: string;
  type: 'income' | 'expense';
  total: number;
}

export interface BalanceSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
}

/**
 * Fetch all wallets sorted by creation date descending.
 */
export async function getWallets(db: SQLiteDatabase): Promise<Wallet[]> {
  return await db.getAllAsync<Wallet>(
    'SELECT id, name, current_balance, icon, created_at FROM wallets ORDER BY created_at DESC'
  );
}

/**
 * Fetch a wallet by its ID.
 */
export async function getWalletById(db: SQLiteDatabase, id: string): Promise<Wallet | null> {
  return await db.getFirstAsync<Wallet>(
    'SELECT id, name, current_balance, icon, created_at FROM wallets WHERE id = ?',
    [id]
  );
}

/**
 * Creates a new wallet with an initial balance and updates current_balance.
 */
export async function createWallet(
  db: SQLiteDatabase,
  wallet: { id: string; name: string; initial_balance?: number; icon: string }
): Promise<void> {
  const balance = wallet.initial_balance ?? 0;
  const createdAt = Date.now();

  await db.runAsync(
    'INSERT INTO wallets (id, name, current_balance, icon, created_at) VALUES (?, ?, ?, ?, ?)',
    [wallet.id, wallet.name, balance, wallet.icon, createdAt]
  );
}

export const addWallet = createWallet;

/**
 * Deletes a wallet and cascades to all its transactions.
 */
export async function deleteWallet(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
}

/**
 * Fetches transactions joined with wallet metadata.
 */
export async function getTransactions(
  db: SQLiteDatabase,
  limit = 50
): Promise<TransactionWithWallet[]> {
  return await db.getAllAsync<TransactionWithWallet>(
    `SELECT 
      t.id, t.wallet_id, t.type, t.amount, t.category, t.description, t.receipt_path, t.date,
      w.name AS wallet_name, w.icon AS wallet_icon
    FROM transactions t
    INNER JOIN wallets w ON t.wallet_id = w.id
    ORDER BY t.date DESC
    LIMIT ?`,
    [limit]
  );
}

export const getRecentTransactions = getTransactions;

/**
 * Calculates current month inflow and outflow summary.
 */
export async function getMonthSummary(
  db: SQLiteDatabase,
  startTimestamp: number
): Promise<{ totalInflow: number; totalOutflow: number }> {
  const incomeResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND date >= ?",
    [startTimestamp]
  );
  const expenseResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND date >= ?",
    [startTimestamp]
  );

  return {
    totalInflow: incomeResult?.total ?? 0,
    totalOutflow: expenseResult?.total ?? 0,
  };
}

/**
 * Creates a transaction and atomically updates the wallet balance.
 */
export async function createTransaction(
  db: SQLiteDatabase,
  tx: {
    id: string;
    wallet_id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string | null;
    receipt_path?: string | null;
    date: number;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (id, wallet_id, type, amount, category, description, receipt_path, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.wallet_id,
        tx.type,
        tx.amount,
        tx.category,
        tx.description ?? null,
        tx.receipt_path ?? null,
        tx.date,
      ]
    );

    const balanceAdjustment = tx.type === 'income' ? tx.amount : -tx.amount;
    await db.runAsync(
      'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
      [balanceAdjustment, tx.wallet_id]
    );
  });
}

export const addTransaction = createTransaction;

/**
 * Deletes a transaction and reverts its impact on the wallet balance.
 */
export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  let receiptToDelete: string | null = null;
  await db.withTransactionAsync(async () => {
    const tx = await db.getFirstAsync<Transaction>(
      'SELECT id, wallet_id, type, amount, receipt_path FROM transactions WHERE id = ?',
      [id]
    );

    if (!tx) return;

    receiptToDelete = tx.receipt_path ?? null;

    const balanceAdjustment = tx.type === 'income' ? -tx.amount : tx.amount;
    await db.runAsync(
      'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
      [balanceAdjustment, tx.wallet_id]
    );

    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  });

  if (receiptToDelete) {
    try {
      const { deleteReceiptImageAsync } = await import('@/utils/fileStorage');
      await deleteReceiptImageAsync(receiptToDelete);
    } catch (e) {
      console.warn('Failed to delete receipt file during tx delete:', e);
    }
  }
}

/**
 * Calculates aggregate balance, income, and expense summary.
 */
export async function getBalanceSummary(db: SQLiteDatabase): Promise<BalanceSummary> {
  const walletResult = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(current_balance) as total FROM wallets'
  );
  const incomeResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'income'"
  );
  const expenseResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'expense'"
  );

  return {
    totalBalance: walletResult?.total ?? 0,
    totalIncome: incomeResult?.total ?? 0,
    totalExpense: expenseResult?.total ?? 0,
  };
}

/**
 * Aggregates expenses by category for analytics.
 */
export async function getExpensesByCategory(db: SQLiteDatabase): Promise<CategorySummary[]> {
  return await db.getAllAsync<CategorySummary>(
    `SELECT category, type, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense'
     GROUP BY category
     ORDER BY total DESC`
  );
}

/**
 * Aggregates expenses by category within a specific timestamp range.
 */
export async function getCategoryBreakdown(
  db: SQLiteDatabase,
  startDate: number,
  endDate: number
): Promise<CategorySummary[]> {
  return await db.getAllAsync<CategorySummary>(
    `SELECT category, type, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND date >= ? AND date <= ?
     GROUP BY category
     ORDER BY total DESC`,
    [startDate, endDate]
  );
}

/**
 * Calculates income and expense summary for a given time range.
 */
export async function getPeriodSummary(
  db: SQLiteDatabase,
  startDate: number,
  endDate: number
): Promise<{ totalIncome: number; totalExpense: number }> {
  const incomeResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?",
    [startDate, endDate]
  );
  const expenseResult = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?",
    [startDate, endDate]
  );

  return {
    totalIncome: incomeResult?.total ?? 0,
    totalExpense: expenseResult?.total ?? 0,
  };
}

/**
 * Fetches transactions within a given timestamp range.
 */
export async function getTransactionsInRange(
  db: SQLiteDatabase,
  startDate: number,
  endDate: number
): Promise<TransactionWithWallet[]> {
  return await db.getAllAsync<TransactionWithWallet>(
    `SELECT 
      t.id, t.wallet_id, t.type, t.amount, t.category, t.description, t.receipt_path, t.date,
      w.name AS wallet_name, w.icon AS wallet_icon
    FROM transactions t
    INNER JOIN wallets w ON t.wallet_id = w.id
    WHERE t.date >= ? AND t.date <= ?
    ORDER BY t.date ASC`,
    [startDate, endDate]
  );
}

/**
 * Aggregates transactions by date for monthly/weekly chart trend analytics.
 */
export async function getDailySpending(
  db: SQLiteDatabase,
  sinceTimestamp: number
): Promise<{ dateStr: string; total: number }[]> {
  return await db.getAllAsync<{ dateStr: string; total: number }>(
    `SELECT strftime('%m-%d', date / 1000, 'unixepoch') as dateStr, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND date >= ?
     GROUP BY dateStr
     ORDER BY date ASC`,
    [sinceTimestamp]
  );
}

/**
 * Fetch all categories or filtered by type ('income' | 'expense')
 */
export async function getCategories(
  db: SQLiteDatabase,
  type?: 'income' | 'expense'
): Promise<Category[]> {
  if (type) {
    return await db.getAllAsync<Category>(
      'SELECT id, name, icon, color, type FROM categories WHERE type = ? ORDER BY created_at ASC',
      [type]
    );
  }
  return await db.getAllAsync<Category>(
    'SELECT id, name, icon, color, type FROM categories ORDER BY created_at ASC'
  );
}

/**
 * Creates a user custom category.
 */
export async function createCategory(
  db: SQLiteDatabase,
  cat: { id: string; name: string; icon: string; color: string; type: 'income' | 'expense' }
): Promise<void> {
  const createdAt = Date.now();
  await db.runAsync(
    'INSERT INTO categories (id, name, icon, color, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [cat.id, cat.name, cat.icon, cat.color, cat.type, createdAt]
  );
}

/**
 * Deletes a category.
 */
export async function deleteCategory(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

/**
 * Clears all transactions and resets wallet balances to zero.
 */
export async function clearAllTransactions(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('UPDATE wallets SET current_balance = 0');
  });
}


