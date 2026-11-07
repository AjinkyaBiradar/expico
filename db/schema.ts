import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id);
  `);

  const walletCount = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM wallets'
  );
  if (!walletCount || walletCount.count === 0) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Calculate Monday of current week
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const daysSinceMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() - daysSinceMonday);
    const mondayTime = monday.getTime();

    // 1. Wallets matching screenshot: Total Balance = $18,220.50
    await db.runAsync(
      `INSERT INTO wallets (id, name, current_balance, icon, created_at) VALUES 
       ('w_checking', 'Main Checking', 12450.00, 'Bank', ?),
       ('w_savings', 'Savings', 5770.50, 'PiggyBank', ?)`,
      [now - 14 * oneDay, now - 14 * oneDay]
    );

    // 2. Transactions matching screenshot:
    // Recent feed: Grocery Shopping (-$135.50), Gas Station (-$135.50), Freelance Project (+$135.50), Monthly Salary (+$5,214.50)
    const seedTx = [
      {
        id: 'tx_1',
        wallet: 'w_checking',
        type: 'expense',
        amount: 135.50,
        cat: 'groceries',
        desc: 'Grocery Shopping',
        date: now - oneDay,
      },
      {
        id: 'tx_2',
        wallet: 'w_checking',
        type: 'expense',
        amount: 135.50,
        cat: 'transport',
        desc: 'Gas Station',
        date: now - oneDay,
      },
      {
        id: 'tx_3',
        wallet: 'w_checking',
        type: 'income',
        amount: 135.50,
        cat: 'freelance',
        desc: 'Freelance Project',
        date: now - 2 * oneDay,
      },
      {
        id: 'tx_4',
        wallet: 'w_checking',
        type: 'income',
        amount: 5214.50,
        cat: 'salary',
        desc: 'Monthly Salary',
        date: now - 3 * oneDay,
      },
      {
        id: 'tx_5',
        wallet: 'w_checking',
        type: 'expense',
        amount: 180.00,
        cat: 'food',
        desc: 'Team Dinner',
        date: mondayTime + 2 * oneDay + 12 * 3600000,
      },
      {
        id: 'tx_6',
        wallet: 'w_checking',
        type: 'income',
        amount: 450.00,
        cat: 'investments',
        desc: 'Dividend Payout',
        date: mondayTime + 2 * oneDay + 14 * 3600000,
      },
      {
        id: 'tx_7',
        wallet: 'w_checking',
        type: 'expense',
        amount: 220.00,
        cat: 'shopping',
        desc: 'Electronics Store',
        date: mondayTime + oneDay + 15 * 3600000,
      },
      {
        id: 'tx_8',
        wallet: 'w_checking',
        type: 'expense',
        amount: 110.00,
        cat: 'bills',
        desc: 'Electricity Bill',
        date: mondayTime + 3 * oneDay + 10 * 3600000,
      },
      {
        id: 'tx_9',
        wallet: 'w_checking',
        type: 'income',
        amount: 320.00,
        cat: 'freelance',
        desc: 'UI Design Milestone',
        date: mondayTime + 3 * oneDay + 16 * 3600000,
      },
      {
        id: 'tx_10',
        wallet: 'w_checking',
        type: 'income',
        amount: 310.00,
        cat: 'gift',
        desc: 'Birthday Gift',
        date: mondayTime + 6 * oneDay + 11 * 3600000,
      },
    ];

    for (const t of seedTx) {
      await db.runAsync(
        `INSERT INTO transactions (id, wallet_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.wallet, t.type, t.amount, t.cat, t.desc, t.date]
      );
    }
  }
}