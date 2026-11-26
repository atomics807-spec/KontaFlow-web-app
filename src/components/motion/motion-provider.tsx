"use client";

import { MotionConfig } from "motion/react";

/**
 * `reducedMotion="user"` makes every Motion animation respect the operating
 * system preference. Transform and layout animations are dropped, opacity
 * fades remain, so nothing moves for users who asked for stillness.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
