"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/**
 * Cross-fades route content on navigation. Only opacity and an 8px translate
 * are animated, both compositor-friendly on low-end Android devices.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
