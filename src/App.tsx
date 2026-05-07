import { useState, useRef, useCallback } from "react";
import { usePiiWorker } from "./hooks/usePiiWorker";
import type { EntitySpan } from "./hooks/usePiiWorker";
import { buildParts, ENTITY_LABEL_MAP } from "./utils/masking";

const C = {
  primary500: "#214698", primary600: "#183582", primaryNew500: "#1766D6",
  primary50: "#EEF2FF", primary100: "#D2E3F9", primary200: "#A8C7F4",
  neutral10: "#FAFAFB", neutral30: "#F3F3F4", neutral50: "#E7E8E9",
  neutral100: "#B2B5B8", neutral200: "#7D8187", neutral300: "#484E56",
  neutral400: "#131A25", shade0: "#FFFFFF",
  success500: "#1F7711", success100: "#DFEADC",
  warning500: "#DD8902", warning100: "#FDF1CB", warning20: "#FFF8E4",
  destructive500: "#A21615", destructive100: "#FADBCD",
  info500: "#0185BA", info100: "#C9FAFB",
  lavender: "#603F83",
};

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const ENTITY_META: Record<string, { color: string; bg: string }> = {
  EMAIL:       { color: C.info500,        bg: C.info100 },
  PHONE:       { color: C.warning500,     bg: C.warning20 },
  PERSON:      { color: C.lavender,       bg: "#F3EEF9" },
  NAME:        { color: C.lavender,       bg: "#F3EEF9" },
  LOC:         { color: C.success500,     bg: C.success100 },
  LOCATION:    { color: C.success500,     bg: C.success100 },
  ORG:         { color: C.primary500,     bg: C.primary50 },
  DATE:        { color: "#7A4A00",        bg: C.warning100 },
  CREDIT_CARD: { color: C.destructive500, bg: C.destructive100 },
  SSN:         { color: C.destructive500, bg: C.destructive100 },
  IP:          { color: C.info500,        bg: C.info100 },
  URL:         { color: C.primary500,     bg: C.primary50 },
};

const SAMPLE_TEXT = `Hello, my name is Dr. Sarah Johnson and I work at Acme Corp Inc.
You can reach me at sarah.johnson@acme.com or call +1 (415) 555-0192.
My SSN is 432-18-9873 and my IP is 192.168.1.42.
I was born on 04/12/1985 and my credit card is 4532 1234 5678 9010.
Our office is in New York, ZIP 10001. Visit https://www.acme.com`;

function EntityChip({ span }: { span: EntitySpan }) {
  const meta = ENTITY_META[span.entity_group] ?? { color: C.primary500, bg: C.primary50 };
  const label = ENTITY_LABEL_MAP[span.entity_group] ?? span.entity_group.toLowerCase();
  return (
    <span title={`Original: "${span.word}"`} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.bg, color: meta.color,
      fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600,
      padding: "1px 10px", borderRadius: 4,
      border: `1px solid ${meta.color}33`, cursor: "default",
    }}>
      <span style={{ fontSize: "0.6rem" }}>●</span>[{label}]
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.neutral50}` }}>
      <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral200 }}>{label}</span>
      <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral400, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: C.shade0, borderRadius: 8, boxShadow: "0px 4px 8px rgba(0,0,0,0.08)", border: `1px solid ${C.neutral50}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.neutral50}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.neutral30 }}>
        <span style={{ fontFamily: FONT, fontSize: "0.875rem", fontWeight: 700, color: C.neutral400 }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ background: bg, color, fontFamily: FONT, fontSize: "0.75rem", fontWeight: 600, padding: "2px 10px", borderRadius: 9999, display: "inline-block" }}>
      {children}
    </span>
  );
}

export default function App() {
  const { state: workerState, loadMs, infer } = usePiiWorker();
  const [input, setInput] = useState("");
  const [spans, setSpans] = useState<EntitySpan[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [timings, setTimings] = useState<number[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gpuSupported = !!navigator.gpu;
  const isReady = workerState === "ready";

  const handleInfer = useCallback((text: string) => {
    if (!text.trim()) { setSpans([]); return; }
    setIsProcessing(true);
    infer(text, (result, elapsed) => {
      setSpans(result);
      setLastMs(elapsed);
      setRunCount(c => c + 1);
      setTimings(prev => [...prev.slice(-9), elapsed]);
      setIsProcessing(false);
    });
  }, [infer]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleInfer(val), 250);
  };

  const loadSample = () => {
    setInput(SAMPLE_TEXT);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleInfer(SAMPLE_TEXT), 250);
  };

  const parts = buildParts(input, spans);
  const entityCounts = spans.reduce<Record<string, number>>((acc, s) => {
    acc[s.entity_group] = (acc[s.entity_group] || 0) + 1;
    return acc;
  }, {});
  const totalPII = spans.length;
  const avgMs = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null;

  return (
    <div style={{ fontFamily: FONT, background: C.neutral10, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(23,102,214,0.15) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Nav */}
      <div style={{ background: C.shade0, borderBottom: `1px solid ${C.neutral50}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 101, boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.primary500, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="white" strokeWidth="1.5"/>
              <circle cx="9" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: C.neutral400, lineHeight: 1.2 }}>Privy</div>
            <div style={{ fontSize: "0.6875rem", color: C.neutral200 }}>PII Filter · by IDfy</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {workerState === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.warning500, animation: "pulse 1.2s infinite" }} />
              <span style={{ fontSize: "0.75rem", color: C.warning500, fontWeight: 500 }}>Loading model…</span>
            </div>
          )}
          {workerState === "ready" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success500 }} />
              <span style={{ fontSize: "0.75rem", color: C.success500, fontWeight: 600 }}>Model ready{loadMs ? ` · loaded in ${loadMs}ms` : ""}</span>
            </div>
          )}
          {workerState === "error" && (
            <span style={{ fontSize: "0.75rem", color: C.destructive500, fontWeight: 600 }}>⚠ Model failed to load</span>
          )}
          <Pill bg={C.primary50} color={C.primary500}>🔒 100% Local · No data leaves browser</Pill>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary500} 0%, #1044A3 100%)`, padding: "28px 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h1 style={{ fontWeight: 800, fontSize: "1.375rem", color: "#fff", marginBottom: 6 }}>PII Detection &amp; Masking</h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", maxWidth: 560 }}>
            Running <code style={{ background: "rgba(255,255,255,0.15)", padding: "1px 6px", borderRadius: 4 }}>openai/privacy-filter</code> locally via Transformers.js &amp; ONNX Runtime Web. Your text never leaves this tab.
          </p>
        </div>
      </div>

      {!gpuSupported && (
        <div style={{ background: C.warning20, borderBottom: `1px solid ${C.warning500}33`, padding: "10px 24px" }}>
          <span style={{ fontSize: "0.875rem", color: C.warning500, fontWeight: 500 }}>⚠ WebGPU not detected. Use Chrome 113+ or Edge 113+ for best performance. CPU fallback is active.</span>
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 40px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Input */}
          <Card title="Input Text" badge={
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isProcessing && <div style={{ width: 14, height: 14, border: `2px solid ${C.primary100}`, borderTopColor: C.primary500, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
              <span style={{ fontSize: "0.75rem", color: C.neutral200 }}>{input.length} chars</span>
            </div>
          }>
            <textarea value={input} onChange={handleChange} disabled={!isReady}
              placeholder={isReady ? "Paste or type text containing personal information…" : "Waiting for model to load…"}
              style={{ width: "100%", minHeight: 200, resize: "vertical", fontFamily: FONT, fontSize: "0.875rem", color: C.neutral400, lineHeight: 1.7, padding: "12px 14px", border: `1px solid ${C.neutral50}`, borderRadius: 4, background: !isReady ? C.neutral10 : C.shade0 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <button onClick={loadSample} disabled={!isReady} style={{ fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600, color: C.primary500, background: C.primary50, border: `1px solid ${C.primary200}`, borderRadius: 4, padding: "6px 14px", cursor: "pointer", opacity: !isReady ? 0.5 : 1 }}>
                Try sample text
              </button>
              {input && <button onClick={() => { setInput(""); setSpans([]); }} style={{ fontFamily: FONT, fontSize: "0.8125rem", color: C.neutral200, background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
            </div>
          </Card>

          {/* Output */}
          <Card title="Masked Output" badge={
            totalPII > 0
              ? <Pill bg={C.destructive100} color={C.destructive500}>{totalPII} PII {totalPII === 1 ? "entity" : "entities"} masked</Pill>
              : <Pill bg={C.success100} color={C.success500}>No PII detected</Pill>
          }>
            {!input
              ? <div style={{ color: C.neutral100, fontSize: "0.875rem", fontStyle: "italic", minHeight: 80, display: "flex", alignItems: "center" }}>Masked output will appear here as you type…</div>
              : <div style={{ fontFamily: FONT, fontSize: "0.875rem", lineHeight: 2, color: C.neutral300, minHeight: 80, animation: "fadeIn 0.2s ease" }}>
                  {parts.map((p, i) =>
                    p.type === "plain"
                      ? <span key={i}>{p.text}</span>
                      : <EntityChip key={i} span={p.span} />
                  )}
                </div>
            }
          </Card>

          {/* Entity breakdown */}
          {totalPII > 0 && (
            <Card title="Detected Entities">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(entityCounts).map(([type, count]) => {
                  const meta = ENTITY_META[type] ?? { color: C.primary500, bg: C.primary50 };
                  const label = ENTITY_LABEL_MAP[type] ?? type.toLowerCase();
                  return (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, background: meta.bg, borderRadius: 6, padding: "6px 12px", border: `1px solid ${meta.color}22` }}>
                      <span style={{ fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600, color: meta.color }}>[{label}]</span>
                      <span style={{ background: meta.color, color: "#fff", borderRadius: 9999, fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Diagnostics */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Runtime Info">
            <StatRow label="Execution provider" value={gpuSupported ? "WebGPU" : "CPU / WASM"} />
            <StatRow label="WebGPU" value={gpuSupported ? "✓ Available" : "✗ Not available"} />
            <StatRow label="Model" value="openai/privacy-filter" />
            <StatRow label="Runtime" value="Transformers.js + ONNX" />
            <StatRow label="Quantized dtype" value="q4 (INT4)" />
            <StatRow label="Model state" value={workerState === "loading" ? "⏳ Loading…" : workerState === "ready" ? "✓ Ready" : "✗ Error"} />
            {loadMs && <StatRow label="Model load time" value={`${loadMs} ms`} />}
          </Card>

          <Card title="Inference Metrics">
            <StatRow label="Last inference" value={lastMs ? `${lastMs} ms` : "—"} />
            <StatRow label="Avg latency" value={avgMs ? `${avgMs} ms` : "—"} />
            <StatRow label="Runs this session" value={runCount} />
            <StatRow label="Debounce interval" value="250 ms" />
            {timings.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: "0.6875rem", color: C.neutral200, marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Rolling latency</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
                  {timings.map((t, i) => {
                    const max = Math.max(...timings);
                    const h = Math.max(4, Math.round((t / max) * 40));
                    return <div key={i} style={{ flex: 1, height: h, background: i === timings.length - 1 ? C.primary500 : C.primary200, borderRadius: 2 }} />;
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card title="Privacy Architecture">
            <StatRow label="Inference location" value="Web Worker" />
            <StatRow label="UI thread blocked" value="Never" />
            <StatRow label="IndexedDB cache" value="Enabled" />
            <StatRow label="Model re-init" value="Singleton" />
            <StatRow label="Text sent to server" value="0 bytes" />
          </Card>

          <div style={{ background: C.primary50, borderRadius: 8, border: `1px solid ${C.primary200}`, padding: "12px 14px" }}>
            <div style={{ fontFamily: FONT, fontSize: "0.75rem", fontWeight: 700, color: C.primary500, marginBottom: 4 }}>🔒 Privacy Guarantee</div>
            <p style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral300, lineHeight: 1.6 }}>All inference runs inside this browser tab. No text or metadata is ever transmitted. The model loads once from HuggingFace and is cached locally via IndexedDB.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.neutral50}`, background: C.shade0, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral200 }}>Privy PII Filter · Powered by <strong style={{ color: C.neutral300 }}>openai/privacy-filter</strong> · 100% local inference</span>
        <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral200 }}>IDfy · No data leaves your browser</span>
      </div>
    </div>
  );
}