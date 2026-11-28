import { speechLanguage } from "@/lib/easy/speech";
import type { Locale } from "@/lib/i18n/config";

const AUDIO_KEY = "kontaflow.easy.audio";
const AUDIO_EVENT = "kontaflow:easy-audio-change";

export function readEasyAudio(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUDIO_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEasyAudio(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIO_KEY, enabled ? "on" : "off");
    window.dispatchEvent(new Event(AUDIO_EVENT));
  } catch {
    // Storage can be unavailable in private mode; the screen still works.
  }
}

export function subscribeEasyAudio(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUDIO_EVENT, listener);
  return () => window.removeEventListener(AUDIO_EVENT, listener);
}

/** Speaks only when the person has left voice guidance on. */
export function speakEasy(text: string, locale: Locale): void {
  if (!text || !readEasyAudio()) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLanguage(locale);
  utterance.rate = 0.88;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
