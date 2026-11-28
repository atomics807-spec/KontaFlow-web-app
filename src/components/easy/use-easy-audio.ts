"use client";

import { useSyncExternalStore } from "react";
import { readEasyAudio, subscribeEasyAudio } from "@/lib/easy/audio";

export function useEasyAudio(): boolean {
  return useSyncExternalStore(subscribeEasyAudio, readEasyAudio, () => true);
}
