"use client";

import { motion } from "motion/react";

/** Small confirmation flourish drawn with SVG path animation. */
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      initial="hidden"
      animate="visible"
    >
      <motion.circle
        cx="24"
        cy="24"
        r="21"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1 } }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <motion.path
        d="M15 25.5 21 31.5 33 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
        transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
