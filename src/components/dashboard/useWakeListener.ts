"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeRms,
  createWakeDetector,
  stepWakeDetector,
  WAKE_SENSITIVITY_PRESETS,
  type WakeSensitivity,
} from "@/lib/wake-detector";

export type WakeListenerStatus = "idle" | "starting" | "listening" | "detected" | "error";
export type WakeListenerError = "unsupported" | "denied" | "failed";

const SAMPLE_INTERVAL_MS = 250;
const SENSITIVITY_STORAGE_KEY = "spanko.wakeSensitivity";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

function readStoredSensitivity(): WakeSensitivity {
  try {
    const stored = localStorage.getItem(SENSITIVITY_STORAGE_KEY);
    if (stored === "low" || stored === "medium" || stored === "high") return stored;
  } catch {
    // localStorage niedostępny (tryb prywatny) — zostajemy przy domyślnej czułości.
  }
  return "medium";
}

async function requestScreenWakeLock(): Promise<WakeLockSentinelLike | null> {
  const wakeLock = (
    navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }
  ).wakeLock;
  if (!wakeLock) return null;
  try {
    return await wakeLock.request("screen");
  } catch {
    return null;
  }
}

/** Krótka wibracja i cichy, ciepły dźwięk na telefonie rodzica. */
function playWakeAlert(context: AudioContext | null) {
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 440;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 1.3);
}

/**
 * Nasłuch mikrofonu w poszukiwaniu pobudki dziecka. Dźwięk jest analizowany wyłącznie
 * lokalnie (poziom głośności), nic nie jest nagrywane ani wysyłane.
 *
 * @param enabled - Czy nasłuch jest dozwolony (np. tylko w trakcie snu); false zatrzymuje go
 */
export function useWakeListener(enabled: boolean) {
  const [status, setStatus] = useState<WakeListenerStatus>("idle");
  const [error, setError] = useState<WakeListenerError | null>(null);
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivityState] = useState<WakeSensitivity>("medium");

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const sensitivityRef = useRef<WakeSensitivity>("medium");
  const detectorRef = useRef(createWakeDetector(0));
  const isActiveRef = useRef(false);

  useEffect(() => {
    const stored = readStoredSensitivity();
    sensitivityRef.current = stored;
    setSensitivityState(stored);
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    setLevel(0);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setError("unsupported");
      setStatus("error");
      return;
    }
    isActiveRef.current = true;
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (!isActiveRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const context = new AudioContext();
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      streamRef.current = stream;
      contextRef.current = context;
      wakeLockRef.current = await requestScreenWakeLock();
      detectorRef.current = createWakeDetector(Date.now());

      intervalRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        const rms = computeRms(buffer);
        const step = stepWakeDetector(
          detectorRef.current,
          rms,
          Date.now(),
          WAKE_SENSITIVITY_PRESETS[sensitivityRef.current],
        );
        detectorRef.current = step.state;
        setLevel(rms);
        if (step.triggered) {
          playWakeAlert(contextRef.current);
          setStatus("detected");
        }
      }, SAMPLE_INTERVAL_MS);
      setStatus("listening");
    } catch (caught) {
      stop();
      const denied =
        caught instanceof DOMException &&
        (caught.name === "NotAllowedError" || caught.name === "SecurityError");
      setError(denied ? "denied" : "failed");
      setStatus("error");
    }
  }, [stop]);

  /** Fałszywy alarm albo wpis zapisany — wracamy do nasłuchu. */
  const resume = useCallback(() => {
    if (isActiveRef.current) setStatus("listening");
  }, []);

  const setSensitivity = useCallback((value: WakeSensitivity) => {
    sensitivityRef.current = value;
    setSensitivityState(value);
    try {
      localStorage.setItem(SENSITIVITY_STORAGE_KEY, value);
    } catch {
      // Brak trwałego zapisu nie blokuje zmiany czułości w bieżącej sesji.
    }
  }, []);

  // Przeglądarka zwalnia blokadę wygaszania po powrocie z tła — odnawiamy ją.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && isActiveRef.current) {
        void requestScreenWakeLock().then((lock) => {
          wakeLockRef.current = lock;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  return { status, error, level, sensitivity, setSensitivity, start, stop, resume };
}
