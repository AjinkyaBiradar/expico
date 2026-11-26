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

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  due_date: number;
  category: string;
  wallet_id?: string | null;
  wallet_name?: string | null;
  wallet_icon?: string | null;
  frequency: 'one-time' | 'weekly' | 'monthly' | 'yearly';
  is_paid: number;
  paid_date?: number | null;
  notes?: string | null;
  created_at: number;
}

export async function getReminders(db: SQLiteDatabase): Promise<Reminder[]> {
  return await db.getAllAsync<Reminder>(
    `SELECT r.*, w.name as wallet_name, w.icon as wallet_icon
     FROM reminders r
     LEFT JOIN wallets w ON r.wallet_id = w.id
     ORDER BY r.due_date ASC`
  );
}

export async function createReminder(
  db: SQLiteDatabase,
  reminder: {
    id: string;
    title: string;
    amount: number;
    due_date: number;
    category: string;
    wallet_id?: string | null;
    frequency?: 'one-time' | 'weekly' | 'monthly' | 'yearly';
    notes?: string | null;
  }
): Promise<void> {
  const createdAt = Date.now();
  await db.runAsync(
    `INSERT INTO reminders (id, title, amount, due_date, category, wallet_id, frequency, is_paid, paid_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [
      reminder.id,
      reminder.title,
      reminder.amount,
      reminder.due_date,
      reminder.category,
      reminder.wallet_id ?? null,
      reminder.frequency ?? 'one-time',
      reminder.notes ?? null,
      createdAt,
    ]
  );
}

export async function deleteReminder(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

export async function markReminderPaid(
  db: SQLiteDatabase,
  id: string,
  recordExpense: boolean = false
): Promise<void> {
  const reminder = await db.getFirstAsync<Reminder>('SELECT * FROM reminders WHERE id = ?', [id]);
  if (!reminder) return;

  await db.withTransactionAsync(async () => {
    const now = Date.now();

    if (recordExpense && reminder.wallet_id && reminder.amount > 0) {
      const txId = 'rem_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.runAsync(
        `INSERT INTO transactions (id, wallet_id, type, amount, category, description, receipt_path, date)
         VALUES (?, ?, 'expense', ?, ?, ?, NULL, ?)`,
        [
          txId,
          reminder.wallet_id,
          reminder.amount,
          reminder.category,
          `Paid Reminder: ${reminder.title}`,
          now,
        ]
      );
      await db.runAsync('UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?', [
        reminder.amount,
        reminder.wallet_id,
      ]);
    }

    if (reminder.frequency && reminder.frequency !== 'one-time') {
      const nextDue = new Date(reminder.due_date);
      if (reminder.frequency === 'weekly') {
        nextDue.setDate(nextDue.getDate() + 7);
      } else if (reminder.frequency === 'monthly') {
        nextDue.setMonth(nextDue.getMonth() + 1);
      } else if (reminder.frequency === 'yearly') {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      }
      await db.runAsync(
        'UPDATE reminders SET due_date = ?, is_paid = 0, paid_date = ? WHERE id = ?',
        [nextDue.getTime(), now, id]
      );
    } else {
      await db.runAsync('UPDATE reminders SET is_paid = 1, paid_date = ? WHERE id = ?', [now, id]);
    }
  });
}

export async function markReminderUnpaid(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE reminders SET is_paid = 0, paid_date = NULL WHERE id = ?', [id]);
}

export async function transferBetweenWallets(
  db: SQLiteDatabase,
  params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    note?: string;
    date?: number;
  }
): Promise<void> {
  const { fromWalletId, toWalletId, amount, note } = params;
  const date = params.date || Date.now();

  const fromWallet = await db.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE id = ?', [fromWalletId]);
  const toWallet = await db.getFirstAsync<Wallet>('SELECT * FROM wallets WHERE id = ?', [toWalletId]);

  if (!fromWallet || !toWallet) {
    throw new Error('Source or destination wallet not found');
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?', [
      amount,
      fromWalletId,
    ]);

    await db.runAsync('UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?', [
      amount,
      toWalletId,
    ]);

    const outTxId = 'tx_out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await db.runAsync(
      `INSERT INTO transactions (id, wallet_id, type, amount, category, description, receipt_path, date)
       VALUES (?, ?, 'expense', ?, 'Transfer Out', ?, NULL, ?)`,
      [
        outTxId,
        fromWalletId,
        amount,
        note ? `${note} (Transfer to ${toWallet.name})` : `Transfer to ${toWallet.name}`,
        date,
      ]
    );

    const inTxId = 'tx_in_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await db.runAsync(
      `INSERT INTO transactions (id, wallet_id, type, amount, category, description, receipt_path, date)
       VALUES (?, ?, 'income', ?, 'Transfer In', ?, NULL, ?)`,
      [
        inTxId,
        toWalletId,
        amount,
        note ? `${note} (Transfer from ${fromWallet.name})` : `Transfer from ${fromWallet.name}`,
        date,
      ]
    );
  });
}


