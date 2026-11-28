"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { parseSpokenAmount, speechLanguage } from "@/lib/easy/speech";
import { cn } from "@/lib/utils";

type SpeechResult = {
  results: {
    length: number;
    [index: number]: {
      length: number;
      [index: number]: { transcript: string };
    };
  };
};

type RecognitionEvent = SpeechResult;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const subscribeToSupport = () => () => {};

function getRecognitionSupport(): boolean {
  return getRecognitionConstructor() !== null;
}

export function VoiceAmountButton({
  onAmount,
  onError,
  className,
}: {
  onAmount: (amount: string) => void;
  onError?: () => void;
  className?: string;
}) {
  const { locale, dict } = useI18n();
  const supported = useSyncExternalStore(subscribeToSupport, getRecognitionSupport, () => false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = speechLanguage(locale);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      const amount = parseSpokenAmount(transcript);
      if (amount) onAmount(amount);
      else onError?.();
    };
    recognition.onerror = () => {
      setListening(false);
      onError?.();
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-5 text-base font-bold text-white transition hover:bg-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
        className,
      )}
    >
      {listening ? <Square className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
      {listening ? dict.easy.listening : dict.easy.speakAmount}
    </button>
  );
}
