import { useState, useRef, useCallback } from "react";
import { usePiiWorker } from "./hooks/usePiiWorker";
import type { EntitySpan } from "./hooks/usePiiWorker";
import { buildParts } from "./utils/masking";

const C = {
  primary500: "#214698", primaryNew: "#1766D6", primaryNewH: "#104EB8",
  primary50: "#EEF2FF", primary100: "#D2E3F9", primary200: "#A8C7F4",
  neutral10: "#FAFAFB", neutral30: "#F3F3F4", neutral50: "#E7E8E9",
  neutral100: "#B2B5B8", neutral200: "#7D8187", neutral300: "#484E56",
  neutral400: "#131A25", shade0: "#FFFFFF",
  success500: "#1F7711", success100: "#DFEADC",
  warning500: "#DD8902", warning100: "#FDF1CB", warning20: "#FFF8E4",
  destructive500: "#A21615", destructive100: "#FADBCD",
  info500: "#0185BA", info100: "#C9FAFB",
  lavender: "#603F83",
  sidebar: "#0f1e3d",
  sidebarActive: "rgba(23,102,214,0.25)",
};

const SW = 64;
const SWO = 224;
const TB = 64;
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const ENTITY_META: Record<string, { color: string; bg: string }> = {
  private_person:  { color: C.lavender,       bg: "#F3EEF9" },
  private_email:   { color: C.info500,         bg: C.info100 },
  private_phone:   { color: C.warning500,      bg: C.warning20 },
  account_number:  { color: C.destructive500,  bg: C.destructive100 },
  private_url:     { color: C.primary500,      bg: C.primary50 },
  private_date:    { color: "#7A4A00",         bg: C.warning100 },
  private_org:     { color: C.primary500,      bg: C.primary50 },
  private_loc:     { color: C.success500,      bg: C.success100 },
  // Indian PII — must match entity_group keys exactly from masking.ts
  aadhaar:         { color: C.destructive500,  bg: C.destructive100 },
  pan:             { color: "#7A4A00",         bg: C.warning100 },
  indian_phone:    { color: C.warning500,      bg: C.warning20 },
  voter_id:        { color: C.lavender,        bg: "#F3EEF9" },
  passport:        { color: C.info500,         bg: C.info100 },
  upi:             { color: C.primary500,      bg: C.primary50 },
  driving_licence: { color: C.success500,      bg: C.success100 },
  gstin:           { color: "#7A4A00",         bg: C.warning100 },
  bank_account:    { color: C.destructive500,  bg: C.destructive100 },
  ifsc:            { color: C.info500,         bg: C.info100 },
  vehicle_reg:     { color: C.success500,      bg: C.success100 },
  // Catch-all for unknown model labels
  secret:          { color: C.neutral300,      bg: C.neutral50 },
};

const SAMPLE_TEXT = `To: hr@techcorp.in
From: priya.sharma@gmail.com

Dear Meera,

Please find my onboarding documents and details below.

Full Name: Priya Sharma
Date of Birth: 15/03/1990
Residential Address: 12 Shastri Nagar, Near Civil Lines, Jaipur 302001

Aadhaar: 2345 6789 0123
PAN: ABCDE1234F
Voter ID: ABC1234567
Passport: P5432109
Vehicle: MH12AB1234

Salary Account: HDFC Bank, A/C 50200987654321, IFSC: HDFC0001234
UPI: priya.sharma@okaxis

You can reach me at +91 98765 43210 or priya.sharma@gmail.com.

Regards,
Priya Sharma`;

function EntityChip({ label, original, entityGroup }: { label: string; original: string; entityGroup: string }) {
  const meta = ENTITY_META[entityGroup] ?? { color: C.primary500, bg: C.primary50 };
  return (
    <span title={`Original: "${original}"`} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.bg, color: meta.color,
      fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600,
      padding: "1px 10px", borderRadius: 4,
      border: `1px solid ${meta.color}33`, cursor: "default",
      verticalAlign: "middle", lineHeight: 1.6,
    }}>
      <span style={{ fontSize: "0.6rem" }}>●</span>[{label}]
    </span>
  );
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: C.shade0, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.07)", border: `1px solid ${C.neutral50}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.neutral50}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.neutral10 }}>
        <span style={{ fontFamily: FONT, fontSize: "0.875rem", fontWeight: 700, color: C.neutral400 }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ background: bg, color, fontFamily: FONT, fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 9999, display: "inline-block" }}>
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ minHeight: 80 }}>
      {[100, 85, 92, 60].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w}%`, borderRadius: 6,
          background: `linear-gradient(90deg, ${C.neutral30} 25%, ${C.neutral50} 50%, ${C.neutral30} 75%)`,
          backgroundSize: "200% 100%",
          animation: "shimmer 1.2s infinite",
          marginBottom: 10,
        }} />
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const w = open ? SWO : SW;
  return (
    <aside style={{
      width: w, minHeight: "100vh", background: C.sidebar,
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 200,
      transition: "width 0.25s ease", overflow: "hidden",
    }}>
      {/* Header with hamburger */}
      <div style={{ height: TB, display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <button onClick={onToggle} style={{
          width: SW, height: TB, display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "none", cursor: "pointer", flexShrink: 0,
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.7 }}>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span style={{
          fontWeight: 800, fontSize: "1rem", color: "#fff", letterSpacing: "-0.02em",
          opacity: open ? 1 : 0, transition: "opacity 0.2s 0.05s",
          whiteSpace: "nowrap", paddingRight: 12,
        }}>Privy</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.5rem 0" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.875rem",
          padding: "0.65rem 0", cursor: "pointer",
          background: C.sidebarActive,
          borderLeft: `3px solid ${C.primaryNew}`,
          whiteSpace: "nowrap",
        }}>
          <div style={{ width: SW, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 8h10M7 12h10M7 16h6"/>
            </svg>
          </div>
          <span style={{
            fontSize: "0.8125rem", fontWeight: 600, color: "#fff",
            opacity: open ? 1 : 0, transition: "opacity 0.15s 0.05s",
            pointerEvents: open ? "auto" : "none",
          }}>Text PII Redaction</span>
        </div>
      </nav>


    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ open, workerState }: { open: boolean; workerState: string }) {
  const [profOpen, setProfOpen] = useState(false);
  const left = open ? SWO : SW;

  return (
    <header style={{
      position: "fixed", left: left, right: 0, top: 0, height: TB,
      background: C.shade0, borderBottom: `1px solid ${C.neutral50}`,
      display: "flex", alignItems: "center", padding: "0 1.75rem",
      zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      transition: "left 0.25s ease", gap: "1rem",
    }}>
      {/* Logo */}
      <img src="/logo.png" alt="Privy by IDfy" style={{ height: 40, objectFit: "contain" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
        }} />
      <div style={{ display: "none", alignItems: "center", gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: "1.2rem", color: C.primary500, letterSpacing: "-0.03em" }}>Privy</span>
        <span style={{ fontSize: "0.75rem", color: C.neutral200, fontWeight: 500 }}>by IDfy</span>
      </div>

      {/* Right */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem", position: "relative" }}>
        {workerState === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.warning500, animation: "pulse 1.2s infinite" }} />
            <span style={{ fontSize: "0.75rem", color: C.warning500, fontWeight: 500, fontFamily: FONT }}>Initialising…</span>
          </div>
        )}
        {workerState === "ready" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success500 }} />
            <span style={{ fontSize: "0.75rem", color: C.success500, fontWeight: 600, fontFamily: FONT }}>Ready</span>
          </div>
        )}
        {workerState === "error" && (
          <span style={{ fontSize: "0.75rem", color: C.destructive500, fontWeight: 600, fontFamily: FONT }}>⚠ Failed</span>
        )}

        {/* Profile */}
        <button onClick={() => setProfOpen(o => !o)} style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.35rem 0.75rem 0.35rem 0.35rem",
          borderRadius: 9999, border: `1px solid ${C.neutral50}`,
          background: C.shade0, cursor: "pointer", fontFamily: FONT,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.primaryNew, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: C.neutral400 }}>Demo User</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.neutral200} strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        {profOpen && (
          <>
            <div onClick={() => setProfOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 10,
              background: C.shade0, border: `1px solid ${C.neutral50}`,
              borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 190, overflow: "hidden",
            }}>
              <div style={{ padding: "0.875rem 1rem", borderBottom: `1px solid ${C.neutral50}` }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: C.neutral400, fontFamily: FONT }}>Demo User</div>
                <div style={{ fontSize: "0.72rem", color: C.neutral200, marginTop: 2, fontFamily: FONT }}>Administrator · IDfy</div>
              </div>
              <div onClick={() => setProfOpen(false)} style={{
                padding: "0.625rem 1rem", fontSize: "0.8125rem", fontWeight: 500,
                color: C.destructive500, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                fontFamily: FONT,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = C.destructive100)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { state: workerState, infer } = usePiiWorker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [spans, setSpans] = useState<EntitySpan[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = workerState === "ready";
  const gpuSupported = !!navigator.gpu;
  const ml = sidebarOpen ? SWO : SW;

  const handleInfer = useCallback((text: string) => {
    if (!text.trim()) { setSpans([]); setIsProcessing(false); return; }
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
    if (!val.trim()) { setSpans([]); setIsProcessing(false); return; }
    setIsProcessing(true);
    debounceRef.current = setTimeout(() => handleInfer(val), 250);
  };

  const loadSample = () => {
    setInput(SAMPLE_TEXT);
    setIsProcessing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleInfer(SAMPLE_TEXT), 250);
  };

  const parts = buildParts(input, spans);
  const totalPII = parts.filter(p => p.type === "entity").length;

  return (
    <div style={{ fontFamily: FONT, background: C.neutral10, minHeight: "100vh", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #F3F3F4; }
        ::-webkit-scrollbar-thumb { background: #E7E8E9; border-radius: 3px; }
        textarea:focus { outline: none; border-color: #1766D6 !important; box-shadow: 0 0 0 3px rgba(23,102,214,0.1) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
      `}</style>

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />

      <div style={{ marginLeft: ml, flex: 1, display: "flex", flexDirection: "column", transition: "margin-left 0.25s ease", minWidth: 0 }}>
        <Topbar open={sidebarOpen} workerState={workerState} />

        <main style={{ padding: "1.75rem 2rem 2rem", marginTop: TB + 1, flex: 1 }}>
          {!gpuSupported && (
            <div style={{ background: C.warning20, border: `1px solid ${C.warning500}33`, borderRadius: 8, padding: "10px 16px", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.875rem", color: C.warning500, fontWeight: 500 }}>⚠ WebGPU not detected. Use Chrome 113+ or Edge 113+ for best performance.</span>
            </div>
          )}

          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: C.neutral400, marginBottom: "1.5rem", fontFamily: FONT }}>
            Text PII Redaction
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 860 }}>

            {/* Input */}
            <Card title="Input Text" badge={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isProcessing && isReady && <div style={{ width: 14, height: 14, border: `2px solid ${C.primary100}`, borderTopColor: C.primary500, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                <span style={{ fontSize: "0.75rem", color: C.neutral200 }}>{input.length} chars</span>
              </div>
            }>
              <textarea
                value={input} onChange={handleChange} disabled={!isReady}
                placeholder={isReady ? "Paste or type text containing personal information…" : "Initialising model, please wait…"}
                style={{
                  width: "100%", minHeight: 220, resize: "vertical",
                  fontFamily: "monospace", fontSize: "0.8125rem", color: C.neutral400,
                  lineHeight: 1.7, padding: "12px 14px",
                  border: `1px solid ${C.neutral50}`, borderRadius: 6,
                  background: !isReady ? C.neutral10 : C.shade0,
                  whiteSpace: "pre-wrap",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <button onClick={loadSample} disabled={!isReady} style={{
                  fontFamily: FONT, fontSize: "0.8125rem", fontWeight: 600,
                  color: C.primaryNew, background: C.shade0,
                  border: `1px solid ${C.primaryNew}`, borderRadius: 8,
                  padding: "6px 14px", cursor: "pointer", opacity: !isReady ? 0.5 : 1,
                }}
                  onMouseEnter={e => { if (isReady) e.currentTarget.style.background = C.primary50; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.shade0; }}
                >Try sample text</button>
                {input && (
                  <button onClick={() => { setInput(""); setSpans([]); }} style={{
                    fontFamily: FONT, fontSize: "0.8125rem", color: C.neutral200,
                    background: "none", border: `1px solid ${C.neutral50}`, borderRadius: 8,
                    padding: "6px 14px", cursor: "pointer",
                  }}>Clear</button>
                )}
              </div>
            </Card>

            {/* Output */}
            <Card title="Masked Output" badge={
              !input ? undefined :
              isProcessing ? <Pill bg={C.primary50} color={C.primary500}>Processing…</Pill> :
              totalPII > 0
                ? <Pill bg={C.destructive100} color={C.destructive500}>{totalPII} PII {totalPII === 1 ? "entity" : "entities"} masked</Pill>
                : <Pill bg={C.success100} color={C.success500}>No PII detected</Pill>
            }>
              {!input
                ? <div style={{ color: C.neutral100, fontSize: "0.875rem", fontStyle: "italic", minHeight: 80, display: "flex", alignItems: "center" }}>
                    Masked output will appear here as you type…
                  </div>
                : isProcessing
                  ? <Skeleton />
                  : <div style={{
                      fontFamily: "monospace", fontSize: "0.8125rem",
                      lineHeight: 1.9, color: C.neutral300,
                      minHeight: 80, animation: "fadeIn 0.2s ease",
                      wordBreak: "break-word", whiteSpace: "pre-wrap",
                      textAlign: "left",
                    }}>
                      {parts.map((p, i) =>
                        p.type === "plain"
                          ? <span key={i}>{p.text}</span>
                          : <EntityChip key={i} label={p.displayLabel} original={p.span.word} entityGroup={p.span.entity_group} />
                      )}
                    </div>
              }
            </Card>


          </div>
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: `1px solid ${C.neutral50}`, background: C.shade0,
          padding: "14px 2rem", display: "flex", justifyContent: "space-between", alignItems: "center",
          marginLeft: 0,
        }}>
          <span style={{ fontFamily: FONT, fontSize: "0.75rem", color: C.neutral200, fontWeight: 600 }}>
            Privy PII Filter
          </span>
          <Pill bg={C.primary50} color={C.primary500}>🔒 Data always remains secure</Pill>
        </footer>
      </div>
    </div>
  );
}