import { useEffect, useRef, useState, useCallback } from "react";

export type EntitySpan = {
  word: string;
  entity_group: string;
  score: number;
  start: number;
  end: number;
};

export type WorkerState = "idle" | "loading" | "ready" | "error";

export function usePiiWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onResultRef = useRef<((spans: EntitySpan[], elapsedMs: number) => void) | null>(null);
  const [state, setState] = useState<WorkerState>("idle");
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pii.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (e) => {
      const { type, id, loadMs, result, elapsed, error } = e.data;
      if (type === "LOAD_OK") { setLoadMs(loadMs); setState("ready"); }
      if (type === "LOAD_ERR") { setError(error); setState("error"); }
      if (type === "INFER_OK" && id === pendingRef.current) {
        onResultRef.current?.(result, elapsed);
        pendingRef.current = null;
      }
    };
    workerRef.current = worker;
    setState("loading");
    worker.postMessage({ type: "LOAD" });
    return () => worker.terminate();
  }, []);

  const infer = useCallback((text: string, onResult: (spans: EntitySpan[], elapsedMs: number) => void) => {
    if (!workerRef.current || state !== "ready") return;
    const id = crypto.randomUUID();
    pendingRef.current = id;
    onResultRef.current = onResult;
    workerRef.current.postMessage({ type: "INFER", id, payload: { text } });
  }, [state]);

  return { state, loadMs, error, infer };
}