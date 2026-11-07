import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard mobile baseline (e.g. iPhone 13/14/15 or standard modern Android 390x844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const windowWidth = SCREEN_WIDTH;
export const windowHeight = SCREEN_HEIGHT;

/**
 * Scales a dimension size proportionally against the baseline width.
 */
export function scale(size: number): number {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

/**
 * Scales a dimension size proportionally against the baseline height.
 */
export function verticalScale(size: number): number {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
}

/**
 * Moderate scaling that factors in a damping factor to avoid oversized elements on tablets.
 * factor = 0.5 (default)
 */
export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}

/**
 * Moderate vertical scaling that factors in a damping factor.
 */
export function moderateVerticalScale(size: number, factor = 0.5): number {
  return size + (verticalScale(size) - size) * factor;
}

/**
 * Scales font size with respect to the user's pixel density and system font scaling.
 */
export function fontScale(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(moderateScale(size, 0.3)));
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;
