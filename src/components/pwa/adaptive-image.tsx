"use client";

import Image, { type ImageProps } from "next/image";
import { useDataSaver } from "@/components/pwa/data-saver-provider";

/**
 * Marketing imagery is decorative. Low-data mode lowers quality and never
 * marks these images as high priority, so a 2G first paint is not blocked.
 */
export function AdaptiveImage({ quality, priority, loading, alt = "", ...props }: ImageProps) {
  const { lowData } = useDataSaver();
  return (
    <Image
      {...props}
      alt={alt}
      quality={lowData ? 40 : (quality ?? 75)}
      priority={lowData ? false : priority}
      loading={lowData ? "lazy" : loading}
    />
  );
}
