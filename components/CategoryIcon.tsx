import {
  Airplane,
  Bank,
  Briefcase,
  CalendarBlank,
  Car,
  Coins,
  CreditCard,
  DeviceMobile,
  DotsThreeOutline,
  FirstAid,
  ForkKnife,
  GameController,
  Gift,
  GraduationCap,
  House,
  Icon,
  Laptop,
  Money,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Taxi,
  TrendUp,
  Wallet,
} from 'phosphor-react-native';
import React from 'react';

import { moderateScale } from '@/utils/styling';

const ICON_MAP: Record<string, Icon> = {
  ForkKnife,
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
  weight?: 'fill' | 'regular' | 'bold';
}

export function CategoryIcon({
  name,
  color = '#4EDEA3',
  size = moderateScale(20),
  weight = 'fill',
}: CategoryIconProps) {
  const IconComponent = ICON_MAP[name] || DotsThreeOutline;
  return <IconComponent size={size} color={color} weight={weight} />;
}
