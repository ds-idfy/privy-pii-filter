import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let pipe: any = null;

async function loadModel() {
  const t0 = performance.now();
  pipe = await pipeline("token-classification", "openai/privacy-filter", {
    device: "webgpu",
    dtype: "q4",
  });
  return Math.round(performance.now() - t0);
}

async function runInference(text: string) {
  if (!pipe) throw new Error("Model not loaded");
  const t0 = performance.now();
  const result = await pipe(text, { aggregation_strategy: "simple" });
  return { result, elapsed: Math.round(performance.now() - t0) };
}

self.addEventListener("message", async (e) => {
  const { type, id, payload } = e.data;

  if (type === "LOAD") {
    try {
      const loadMs = await loadModel();
      self.postMessage({ type: "LOAD_OK", loadMs });
    } catch (err) {
      self.postMessage({ type: "LOAD_ERR", error: String(err) });
    }
  }

  if (type === "INFER") {
    try {
      const { result, elapsed } = await runInference(payload.text);
      self.postMessage({ type: "INFER_OK", id, result, elapsed });
    } catch (err) {
      self.postMessage({ type: "INFER_ERR", id, error: String(err) });
    }
  }
});