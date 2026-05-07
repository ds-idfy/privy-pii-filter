import { useState, useRef, useCallback } from "react";
import { usePiiWorker } from "./hooks/usePiiWorker";
import type { EntitySpan } from "./hooks/usePiiWorker";
import { buildParts, ENTITY_LABEL_MAP } from "./utils/masking";

const C = {
  primary500: "#214698", primary600: "#183582",
  primary50: "#EEF2FF", primary100: "#D2E3F9", primary200: "#A8C7F4",
  neutral10: "#FAFAFB", neutral30: "#F3F3F4", neutral50: "#E7E8E9",
  neutral100: "#B2B5B8", neutral200: "#7D8187", neutral300: "#484E56",
  neutral400: "#131A25", shade0: "#FFFFFF",
  success500: "#1F7711", success100: "#DFEADC",
  warning500: "#DD8902", warning20: "#FFF8E4",
  destructive500: "#A21615", destructive100: "#FADBCD",
  info500: "#0185BA", info100: "#C9FAFB",
  warning100: "#FDF1CB",
  lavender: "#603F83",
};

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const ENTITY_META: Record<string, { color: string; bg: string }> = {
  private_person:  { color: C.lavender,      bg: "#F3EEF9" },
  private_email:   { color: C.info500,        bg: C.info100 },
  private_phone:   { color: C.warning500,     bg: C.warning20 },
  account_number:  { color: C.destructive500, bg: C.destructive100 },
  private_url:     { color: C.primary500,     bg: C.primary50 },
  private_date:    { color: "#7A4A00",        bg: C.warning100 },
  private_org:     { color: C.primary500,     bg: C.primary50 },
  private_loc:     { color: C.success500,     bg: C.success100 },
};

const SAMPLE_TEXT = `Hello, my name is Dr. Sarah Johnson and I work at Acme Corp Inc.
You can reach me at sarah.johnson@acme.com or call +1 (415) 555-0192.
My SSN is 432-18-9873 and my IP is 192.168.1.42.
I was born on 04/12/1985 and my credit card is 4532 1234 5678 9010.
Our office is in New York, ZIP 10001. Visit https://www.acme.com`;

function EntityChip({ label, original, entityGroup }: { label: string; original: string; entityGroup: string }) {
  const meta = ENTITY_META[entityGroup] ?? { color: C.primary500, bg: C.primary50 };
  return (
    <span title={`Original: "${original}"`} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.bg, color: meta.color,
      fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600,
      padding: "1px 10px", borderRadius: 4,
      border: `1px solid ${meta.color}33`, cursor: "default",
      verticalAlign: "middle",
    }}>
      <span style={{ fontSize: "0.6rem" }}>●</span>[{label}]
    </span>
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

function Logo() {
  return (
    <img
      src="/logo.png"
      alt="Logo"
      style={{ height: 32, objectFit: "contain" }}
      onError={(e) => {
        // Fallback to text if logo file not found
        const target = e.currentTarget;
        target.style.display = "none";
        const fallback = target.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = "flex";
      }}
    />
  );
}

function LogoFallback() {
  return (
    <div style={{ display: "none", alignItems: "center", gap: 10 }}>
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
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5, borderRadius: 4 }}
        aria-label="Menu"
      >
        <span style={{ display: "block", width: 20, height: 2, background: C.neutral300, borderRadius: 2 }} />
        <span style={{ display: "block", width: 20, height: 2, background: C.neutral300, borderRadius: 2 }} />
        <span style={{ display: "block", width: 20, height: 2, background: C.neutral300, borderRadius: 2 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <div style={{
            position: "absolute", top: 40, left: 0, zIndex: 10,
            background: C.shade0, borderRadius: 8, minWidth: 220,
            boxShadow: "0px 4px 16px rgba(0,0,0,0.12)", border: `1px solid ${C.neutral50}`,
            overflow: "hidden",
          }}>
            <div style={{ padding: "6px 0" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", background: C.primary50,
                borderLeft: `3px solid ${C.primary500}`,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke={C.primary500} strokeWidth="1.5"/>
                  <path d="M4 7h8M4 10h5" stroke={C.primary500} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontFamily: FONT, fontSize: "0.875rem", fontWeight: 600, color: C.primary500 }}>Text PII Redaction</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserAvatar() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: C.neutral50, border: `1.5px solid ${C.neutral100}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="6.5" r="3" stroke={C.neutral300} strokeWidth="1.5"/>
          <path d="M2.5 15.5c0-3.314 2.91-6 6.5-6s6.5 2.686 6.5 6" stroke={C.neutral300} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600, color: C.neutral400, lineHeight: 1.2 }}>Demo User</div>
        <div style={{ fontFamily: FONT, fontSize: "0.6875rem", color: C.neutral200 }}>demo@idfy.com</div>
      </div>
    </div>
  );
}

export default function App() {
  const { state: workerState, infer } = usePiiWorker();
  const [input, setInput] = useState("");
  const [spans, setSpans] = useState<EntitySpan[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = workerState === "ready";
  const gpuSupported = !!navigator.gpu;

  const handleInfer = useCallback((text: string) => {
    if (!text.trim()) { setSpans([]); return; }
    setIsProcessing(true);
    infer(text, (result) => {
      setSpans(result);
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
        
        {/* Left: hamburger + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <HamburgerMenu />
          <div style={{ display: "flex", alignItems: "center" }}>
            <Logo />
            <LogoFallback />
          </div>
        </div>

        {/* Right: status + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {workerState === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.warning500, animation: "pulse 1.2s infinite" }} />
              <span style={{ fontSize: "0.75rem", color: C.warning500, fontWeight: 500 }}>Loading…</span>
            </div>
          )}
          {workerState === "ready" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success500 }} />
              <span style={{ fontSize: "0.75rem", color: C.success500, fontWeight: 600 }}>Ready</span>
            </div>
          )}
          {workerState === "error" && (
            <span style={{ fontSize: "0.75rem", color: C.destructive500, fontWeight: 600 }}>⚠ Failed to load</span>
          )}
          <UserAvatar />
        </div>
      </div>

      {/* Hero — clean, title only */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary500} 0%, #1044A3 100%)`, padding: "24px 24px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ fontWeight: 800, fontSize: "1.375rem", color: "#fff" }}>PII Detection &amp; Masking</h1>
        </div>
      </div>

      {!gpuSupported && (
        <div style={{ background: C.warning20, borderBottom: `1px solid ${C.warning500}33`, padding: "10px 24px" }}>
          <span style={{ fontSize: "0.875rem", color: C.warning500, fontWeight: 500 }}>⚠ WebGPU not detected. Use Chrome 113+ or Edge 113+ for best performance.</span>
        </div>
      )}

      {/* Body — single column, clean */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 48px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Input */}
        <Card title="Input Text" badge={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isProcessing && <div style={{ width: 14, height: 14, border: `2px solid ${C.primary100}`, borderTopColor: C.primary500, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            <span style={{ fontSize: "0.75rem", color: C.neutral200 }}>{input.length} chars</span>
          </div>
        }>
          <textarea
            value={input}
            onChange={handleChange}
            disabled={!isReady}
            placeholder={isReady ? "Paste or type text containing personal information…" : "Initialising, please wait…"}
            style={{ width: "100%", minHeight: 180, resize: "vertical", fontFamily: FONT, fontSize: "0.875rem", color: C.neutral400, lineHeight: 1.7, padding: "12px 14px", border: `1px solid ${C.neutral50}`, borderRadius: 4, background: !isReady ? C.neutral10 : C.shade0 }}
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
            : input ? <Pill bg={C.success100} color={C.success500}>No PII detected</Pill> : undefined
        }>
          {!input
            ? <div style={{ color: C.neutral100, fontSize: "0.875rem", fontStyle: "italic", minHeight: 80, display: "flex", alignItems: "center" }}>Masked output will appear here as you type…</div>
            : <div style={{ fontFamily: FONT, fontSize: "0.875rem", lineHeight: 2.2, color: C.neutral300, minHeight: 80, animation: "fadeIn 0.2s ease", wordBreak: "break-word" }}>
                {parts.map((p, i) =>
                  p.type === "plain"
                    ? <span key={i}>{p.text}</span>
                    : <EntityChip key={i} label={p.displayLabel} original={p.span.word} entityGroup={p.span.entity_group} />
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
                const label = ENTITY_LABEL_MAP[type] ?? type;
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

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.neutral50}`, background: C.shade0, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral200 }}>Privy PII Filter · 100% local inference · No data leaves your browser</span>
        <Pill bg={C.primary50} color={C.primary500}>🔒 Privacy-first</Pill>
      </div>
    </div>
  );
}