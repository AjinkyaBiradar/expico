export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#00E5FF', type: 'expense' },
  { id: 'transport', name: 'Transportation', icon: 'Car', color: '#8B5CF6', type: 'expense' },
  { id: 'food', name: 'Food & Dining', icon: 'ForkKnife', color: '#FB923C', type: 'expense' },
  { id: 'rent', name: 'Rent & Housing', icon: 'House', color: '#6366F1', type: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: 'Bag', color: '#EC4899', type: 'expense' },
  { id: 'bills', name: 'Bills & Utilities', icon: 'Receipt', color: '#38BDF8', type: 'expense' },
  { id: 'entertainment', name: 'Entertainment', icon: 'GameController', color: '#06B6D4', type: 'expense' },
  { id: 'health', name: 'Healthcare', icon: 'FirstAid', color: '#EF4444', type: 'expense' },
  { id: 'education', name: 'Education', icon: 'GraduationCap', color: '#F59E0B', type: 'expense' },
  { id: 'travel', name: 'Travel', icon: 'Airplane', color: '#14B8A6', type: 'expense' },
  { id: 'other_expense', name: 'Other Expense', icon: 'DotsThreeOutline', color: '#64748B', type: 'expense' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', icon: 'CalendarBlank', color: '#F43F5E', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: '#FACC15', type: 'income' },
  { id: 'investments', name: 'Investments', icon: 'TrendUp', color: '#2DD4BF', type: 'income' },
  { id: 'gift', name: 'Gifts', icon: 'Gift', color: '#EC4899', type: 'income' },
  { id: 'other_income', name: 'Other Income', icon: 'Coins', color: '#00E5FF', type: 'income' },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryById(id: string): Category {
  const found = ALL_CATEGORIES.find((cat) => cat.id === id);
  if (found) return found;
  return {
    id,
    name: id,
    icon: 'Question',
    color: '#64748B',
    type: 'expense',
  };
}
