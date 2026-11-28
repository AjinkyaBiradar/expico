import {
  Airplane,
  Bank,
  BeerBottle,
  BowlFood,
  Bread,
  Briefcase,
  CalendarBlank,
  Car,
  Carrot,
  Coffee,
  Coins,
  Cookie,
  CookingPot,
  CreditCard,
  DeviceMobile,
  DotsThreeOutline,
  Drop,
  Egg,
  FirstAid,
  Fish,
  ForkKnife,
  GameController,
  Gift,
  GraduationCap,
  Hamburger,
  House,
  IceCream,
  Icon,
  Laptop,
  Martini,
  Money,
  PiggyBank,
  Pizza,
  Receipt,
  ShoppingCart,
  Taxi,
  TrendUp,
  Wallet,
  Wine,
} from 'phosphor-react-native';

import { useTheme } from '@/features/theme';
import { moderateScale } from '@/utils/styling';

const ICON_MAP: Record<string, Icon> = {
  ForkKnife,
  Coffee,
  Pizza,
  Hamburger,
  Carrot,
  CookingPot,
  BowlFood,
  BeerBottle,
  Wine,
  Martini,
  Bread,
  Cookie,
  IceCream,
  Egg,
  Fish,
  Drop,
  ShoppingCart,
  House,
  Car,
  Taxi,
  Receipt,
  GameController,
  FirstAid,
  GraduationCap,
  Airplane,
  Briefcase,
  Laptop,
  DeviceMobile,
  TrendUp,
  Gift,
  Coins,
  Wallet,
  Bank,
  CreditCard,
  Money,
  PiggyBank,
  CalendarBlank,
  DotsThreeOutline,
};

interface CategoryIconProps {
  name: string;
  color?: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

export function CategoryIcon({
  name,
  color,
  size = moderateScale(20),
  weight = 'fill',
}: CategoryIconProps) {
  const { colors } = useTheme();
  const IconComponent = ICON_MAP[name] || DotsThreeOutline;
  return <IconComponent size={size} color={color || colors.textMuted} weight={weight} />;
}
