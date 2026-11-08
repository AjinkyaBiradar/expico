import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  try {
    try {
      await db.execAsync('PRAGMA journal_mode = WAL;');
    } catch (e) {
      console.warn('[SQLite] Could not set journal_mode WAL:', e);
    }

    try {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    } catch (e) {
      console.warn('[SQLite] Could not enable foreign_keys:', e);
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        current_balance REAL DEFAULT 0,
        icon TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        wallet_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        receipt_path TEXT,
        date INTEGER NOT NULL,
        FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_cat_type ON categories(type);
    `);

    // Safely remove any legacy demo/default transactions and demo wallets
    try {
      await db.runAsync(
        `DELETE FROM transactions WHERE id IN ('tx_1', 'tx_2', 'tx_3', 'tx_4', 'tx_5', 'tx_6', 'tx_7', 'tx_8', 'tx_9', 'tx_10') OR wallet_id IN ('w_checking', 'w_savings')`
      );
      await db.runAsync(
        `DELETE FROM wallets WHERE id IN ('w_checking', 'w_savings')`
      );
    } catch (cleanupErr) {
      console.warn('[SQLite] Optional cleanup warning:', cleanupErr);
    }

    const walletCount = await db.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM wallets'
    );
    if (!walletCount || walletCount.count === 0) {
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO wallets (id, name, current_balance, icon, created_at) VALUES 
         ('w_main', 'Main Wallet', 0.00, 'Bank', ?)`,
        [now]
      );
    }
  } catch (error) {
    console.error('[SQLite] Critical migration error:', error);
    throw error;
  }
}