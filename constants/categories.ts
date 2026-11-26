export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

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

/**
 * Intelligent category detection for distinct food & dining icons and unique color tints.
 * Avoids the issue where every food category defaults to the exact same ForkKnife icon.
 */
export function getDistinctFoodMeta(name: string, fallbackColor?: string): { icon: string; color: string } | null {
  const lower = name.toLowerCase();

  if (/coffee|cafe|tea|starbucks|espresso|latte|cappuccino|chai/.test(lower)) {
    return { icon: 'Coffee', color: '#92400E' }; // Espresso Amber
  }
  if (/pizza|domino|italian|slice/.test(lower)) {
    return { icon: 'Pizza', color: '#EA580C' }; // Pizza Orange
  }
  if (/burger|mcdonald|fast\s?food|kfc|fries|wendy|subway/.test(lower)) {
    return { icon: 'Hamburger', color: '#CA8A04' }; // Golden Mustard
  }
  if (/grocer|market|supermarket|vegetable|veggie|produce|fruits?|mart|subji/.test(lower)) {
    return { icon: 'Carrot', color: '#16A34A' }; // Fresh Garden Green
  }
  if (/bakery|bread|toast|bagel|pastry|croissant/.test(lower)) {
    return { icon: 'Bread', color: '#D97706' }; // Bakery Gold
  }
  if (/beer|pub|bar|brew|alcohol|liquor|beverage|soda|drink/.test(lower)) {
    return { icon: 'BeerBottle', color: '#7C3AED' }; // Royal Purple
  }
  if (/wine|cocktail|lounge|club|martini/.test(lower)) {
    return { icon: 'Wine', color: '#C026D3' }; // Fuchsia Wine
  }
  if (/snack|sweet|dessert|cookie|chocolate|candy|treat|chips/.test(lower)) {
    return { icon: 'Cookie', color: '#DB2777' }; // Berry Pink
  }
  if (/ice\s?cream|gelato|frozen|sundae/.test(lower)) {
    return { icon: 'IceCream', color: '#0284C7' }; // Frost Cyan
  }
  if (/breakfast|egg|brunch|omelet/.test(lower)) {
    return { icon: 'Egg', color: '#F59E0B' }; // Sunny Gold
  }
  if (/seafood|fish|sushi|prawn/.test(lower)) {
    return { icon: 'Fish', color: '#0D9488' }; // Ocean Teal
  }
  if (/restaurant|dinner|lunch|eating\s?out|dine|takeout|delivery|zomato|swiggy|ubereats|cook|cooking/.test(lower)) {
    return { icon: 'CookingPot', color: '#E11D48' }; // Warm Crimson
  }
  if (/food|meal/.test(lower)) {
    return { icon: 'BowlFood', color: '#F43F5E' }; // Coral Red
  }

  return null;
}

export function getCategoryById(id: string): Category {
  if (categoryRegistry.has(id)) {
    const registered = categoryRegistry.get(id)!;
    // If the category uses generic ForkKnife or default icon, provide distinct food icon & tint if name matches
    if (registered.icon === 'ForkKnife' || registered.icon === 'DotsThreeOutline' || !registered.icon) {
      const distinct = getDistinctFoodMeta(registered.name, registered.color);
      if (distinct) {
        return {
          ...registered,
          icon: distinct.icon,
          color: registered.color && registered.color !== '#86948A' && registered.color !== '#F43F5E'
            ? registered.color
            : distinct.color,
        };
      }
    }
    return registered;
  }

  const cleanName = id
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const distinct = getDistinctFoodMeta(cleanName);

  return {
    id,
    name: cleanName || 'General',
    icon: distinct ? distinct.icon : 'DotsThreeOutline',
    color: distinct ? distinct.color : '#86948A',
    type: 'expense',
  };
}

export const AVAILABLE_CATEGORY_ICONS = [
  // Food & Dining Distinct Icons
  { name: 'Coffee', label: 'Coffee' },
  { name: 'Pizza', label: 'Pizza' },
  { name: 'Hamburger', label: 'Fast Food' },
  { name: 'Carrot', label: 'Groceries' },
  { name: 'CookingPot', label: 'Cooking' },
  { name: 'BowlFood', label: 'Meals' },
  { name: 'BeerBottle', label: 'Drinks' },
  { name: 'Wine', label: 'Wine/Bar' },
  { name: 'Bread', label: 'Bakery' },
  { name: 'Cookie', label: 'Snacks' },
  { name: 'IceCream', label: 'Dessert' },
  { name: 'Egg', label: 'Breakfast' },
  { name: 'Fish', label: 'Seafood' },
  { name: 'ForkKnife', label: 'Dining' },

  // Lifestyle, Transport, Services
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
