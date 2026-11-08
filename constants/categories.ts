export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

// Default categories have been removed as requested.
// Categories are now dynamically user-created and stored in the database.
export const EXPENSE_CATEGORIES: Category[] = [];
export const INCOME_CATEGORIES: Category[] = [];
export const ALL_CATEGORIES: Category[] = [];

const categoryRegistry = new Map<string, Category>();

export function registerCategory(cat: Category): void {
  categoryRegistry.set(cat.id, cat);
}

export function registerCategories(cats: Category[]): void {
  cats.forEach((c) => categoryRegistry.set(c.id, c));
}

export function getCategoryById(id: string): Category {
  if (categoryRegistry.has(id)) {
    return categoryRegistry.get(id)!;
  }
  const cleanName = id
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    id,
    name: cleanName || 'General',
    icon: 'DotsThreeOutline',
    color: '#86948A',
    type: 'expense',
  };
}

export const AVAILABLE_CATEGORY_ICONS = [
  { name: 'ForkKnife', label: 'Food' },
  { name: 'ShoppingCart', label: 'Shopping' },
  { name: 'House', label: 'Housing' },
  { name: 'Car', label: 'Transport' },
  { name: 'Taxi', label: 'Transit' },
  { name: 'Receipt', label: 'Bills' },
  { name: 'GameController', label: 'Fun' },
  { name: 'FirstAid', label: 'Health' },
  { name: 'GraduationCap', label: 'Education' },
  { name: 'Airplane', label: 'Travel' },
  { name: 'Briefcase', label: 'Work' },
  { name: 'Laptop', label: 'Tech' },
  { name: 'DeviceMobile', label: 'Gadget' },
  { name: 'TrendUp', label: 'Invest' },
  { name: 'Gift', label: 'Gift' },
  { name: 'Coins', label: 'Earnings' },
  { name: 'Wallet', label: 'Wallet' },
  { name: 'Bank', label: 'Bank' },
  { name: 'CreditCard', label: 'Card' },
  { name: 'Money', label: 'Cash' },
  { name: 'PiggyBank', label: 'Savings' },
  { name: 'CalendarBlank', label: 'Sub/Regular' },
  { name: 'DotsThreeOutline', label: 'Other' },
];

export const AVAILABLE_CATEGORY_COLORS = [
  '#10B981', // Emerald
  '#6FFBBE', // Mint
  '#4EDEA3', // Neon Emerald
  '#2DD4BF', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#C0C1FF', // Periwinkle
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#FACC15', // Yellow
  '#86948A', // Slate
];
