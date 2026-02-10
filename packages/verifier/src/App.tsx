import { useState } from "react";
import type { PoKCertificate, SessionTelemetry } from "@efforia/shared";
import {
  certificateMatchesSession,
  CHAINS,
  getDefaultContractAddress,
  validateCertificate,
} from "./verify";

type Step = "upload" | "result";

function hexToBytes32(hex: string): `0x${string}` {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = h.padStart(64, "0").slice(-64);
  return ("0x" + padded) as `0x${string}`;
}

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [cert, setCert] = useState<PoKCertificate | null>(null);
  const [session, setSession] = useState<SessionTelemetry | null>(null);
  const [hashMatch, setHashMatch] = useState<boolean | null>(null);
  const [onChain, setOnChain] = useState<{
    found: boolean;
    score: string;
    timestamp: string;
    author: string;
    error?: string;
  } | null>(null);
  const [contractAddress, setContractAddress] = useState(getDefaultContractAddress());
  const [selectedChain, setSelectedChain] = useState(CHAINS[0]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function processCertJson(data: Record<string, unknown>) {
    if (data.keystrokes && data.editOps && data.idleActive) {
      alert(
        "You uploaded a session file (efforia-session.json).\n\n" +
        "The verifier needs a certificate file (e.g. my-certificate.json) from the fingerprint tool.\n\n" +
        "Steps:\n" +
        "1. In terminal run: node packages\\fingerprint\\dist\\cli.js \"path\\to\\efforia-session.json\" my-certificate.json\n" +
        "2. Upload my-certificate.json here.\n\n" +
        "You can use your session file in the \"Recompute from session\" section below after uploading a certificate."
      );
      return;
    }
    if (typeof data.fingerprint_hash === "string" && typeof data.human_effort_score === "number") {
      const cert: PoKCertificate = {
        fingerprint_hash: data.fingerprint_hash,
        human_effort_score: data.human_effort_score,
        confidence_level: (data.confidence_level as PoKCertificate["confidence_level"]) ?? "medium",
        timestamp: typeof data.timestamp === "string" ? data.timestamp : new Date().toISOString(),
        ...(typeof data.author_address === "string" && { author_address: data.author_address }),
        ...(typeof data.session_duration_seconds === "number" && { session_duration_seconds: data.session_duration_seconds }),
        ...(data.score_breakdown && typeof data.score_breakdown === "object" && !Array.isArray(data.score_breakdown)
          ? { score_breakdown: data.score_breakdown as PoKCertificate["score_breakdown"] }
          : {}),
      };
          setCert(cert);
      setStep("result");
      setOnChain(null);
      setHashMatch(null);
    } else throw new Error("Invalid certificate format. Need fingerprint_hash and human_effort_score (from the fingerprint tool).");
  }

  function processSessionJson(data: Record<string, unknown>) {
    if (data.keystrokes && data.editOps && data.idleActive) {
      setSession(data as unknown as SessionTelemetry);
    } else throw new Error("Invalid session format");
  }

  function readFileAsJson(file: File, onData: (data: Record<string, unknown>) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, unknown>;
        onData(data);
      } catch (err) {
        alert("Invalid JSON or format: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
  }

  const handleCertFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    readFileAsJson(f, processCertJson);
  };

  const handleSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    readFileAsJson(f, processSessionJson);
  };

  const handleDrop = (e: React.DragEvent, type: "cert" | "session") => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.name.endsWith(".json")) return;
    if (type === "cert") readFileAsJson(f, processCertJson);
    else readFileAsJson(f, processSessionJson);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);

  const checkHashMatch = async () => {
    if (!cert || !session) return;
    setLoading(true);
    try {
      const match = await certificateMatchesSession(cert, session);
      setHashMatch(match);
    } catch (e) {
      setHashMatch(false);
    }
    setLoading(false);
  };

  const verifyOnChain = async () => {
    if (!cert) return;
    const addr = contractAddress.trim();
    if (!addr) {
      setOnChain({ found: false, score: "", timestamp: "", author: "", error: "Contract address required" });
      return;
    }
    try {
      validateCertificate(cert);
    } catch (e) {
      setOnChain({ found: false, score: "", timestamp: "", author: "", error: (e as Error).message });
      return;
    }
    setLoading(true);
    setOnChain(null);
    const chain = selectedChain;
    try {
      const { createPublicClient, http, defineChain } = await import("viem");
      const chainConfig = defineChain({
        id: chain.id,
        name: chain.name,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [chain.rpc] } },
        blockExplorers: { default: { name: "Explorer", url: chain.explorer } },
      });
      const client = createPublicClient({
        chain: chainConfig,
        transport: http(chain.rpc),
      });
      const hashBytes32 = hexToBytes32(cert.fingerprint_hash);
      const exists = await client.readContract({
        address: addr as `0x${string}`,
        abi: [
          {
            name: "verify",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "fingerprintHash", type: "bytes32" }],
            outputs: [{ type: "bool" }],
          },
          {
            name: "getRecord",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "fingerprintHash", type: "bytes32" }],
            outputs: [
              { name: "hash_", type: "bytes32" },
              { name: "score", type: "uint256" },
              { name: "timestamp", type: "uint256" },
              { name: "author", type: "address" },
              { name: "exists", type: "bool" },
            ],
          },
        ],
        functionName: "verify",
        args: [hashBytes32],
      });
      if (!exists) {
        setOnChain({ found: false, score: "", timestamp: "", author: "" });
        setLoading(false);
        return;
      }
      const record = await client.readContract({
        address: addr as `0x${string}`,
        abi: [
          {
            name: "getRecord",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "fingerprintHash", type: "bytes32" }],
            outputs: [
              { name: "hash_", type: "bytes32" },
              { name: "score", type: "uint256" },
              { name: "timestamp", type: "uint256" },
              { name: "author", type: "address" },
              { name: "exists", type: "bool" },
            ],
          },
        ],
        functionName: "getRecord",
        args: [hashBytes32],
      });
      const [_, score, timestamp, author] = record;
      setOnChain({
        found: true,
        score: String(Number(score) / 1000),
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        author: author as string,
      });
    } catch (e) {
      setOnChain({
        found: false,
        score: "",
        timestamp: "",
        author: "",
        error: (e as Error).message,
      });
    }
    setLoading(false);
  };

  const reset = () => {
    setCert(null);
    setSession(null);
    setHashMatch(null);
    setOnChain(null);
    setStep("upload");
  };

  return (
    <>
      <h1>Efforia PoK Verifier</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Verify Proof-of-Knowledge certificates against the blockchain
      </p>

      {step === "upload" && (
        <div className="card">
          <h2>Upload certificate</h2>
          <p>
            Upload <strong>my-certificate.json</strong> (output of the fingerprint tool), not the session file.
            <br />
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              If you upload efforia-session.json here by mistake, you’ll get a hint to use the certificate instead.
            </span>
          </p>
          <div
            onDrop={(e) => handleDrop(e, "cert")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "8px",
              padding: "1.5rem",
              textAlign: "center",
              marginTop: "0.5rem",
              marginBottom: "0.5rem",
              background: dragOver ? "rgba(88, 166, 255, 0.05)" : "transparent",
            }}
          >
            <p style={{ color: "var(--muted)", margin: "0 0 0.5rem 0" }}>No certificate uploaded</p>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Drop a certificate JSON here or choose a file</p>
            <input
              type="file"
              accept=".json"
              onChange={handleCertFile}
              style={{ marginTop: "0.75rem" }}
            />
          </div>
        </div>
      )}

      {step === "result" && cert && (
        <div className="card">
          <h2>Certificate</h2>
          <p><strong>Fingerprint hash</strong></p>
          <p className="mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{cert.fingerprint_hash}</p>
          <p><strong>Human effort score</strong> {(cert.human_effort_score * 100).toFixed(1)}%</p>
          <p><strong>Confidence</strong> {cert.confidence_level}</p>
          <p><strong>Timestamp</strong> {cert.timestamp}</p>
          {cert.score_breakdown && Object.keys(cert.score_breakdown).length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <strong>Score breakdown</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                {Object.entries(cert.score_breakdown)
                  .filter(([, v]) => typeof v === "number")
                  .map(([k, v]) => (
                    <li key={k}>{k}: {(Number(v) * 100).toFixed(0)}%</li>
                  ))}
              </ul>
            </div>
          )}

          <h2 style={{ marginTop: "1.5rem" }}>Recompute from session (optional)</h2>
          <p>Upload the session JSON to verify the certificate hash matches the session.</p>
          <div
            onDrop={(e) => handleDrop(e, "session")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "8px",
              padding: "1rem",
              textAlign: "center",
              marginTop: "0.5rem",
              background: dragOver ? "rgba(88, 166, 255, 0.05)" : "transparent",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Drop session JSON or choose file</p>
            <input type="file" accept=".json" onChange={handleSessionFile} style={{ marginTop: "0.5rem" }} />
          </div>
          {session && (
            <button onClick={checkHashMatch} disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Checking…" : "Check hash match"}
            </button>
          )}
          {hashMatch === true && <p className="valid">✓ Certificate hash matches session.</p>}
          {hashMatch === false && <p className="invalid">✗ Certificate hash does not match session.</p>}

          <h2 style={{ marginTop: "1.5rem" }}>Verify on chain</h2>
          <p>Chain:</p>
          <select
            value={selectedChain.id}
            onChange={(e) => {
              const c = CHAINS.find((x) => x.id === Number(e.target.value));
              if (c) setSelectedChain(c);
            }}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              fontFamily: "var(--font)",
            }}
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p>Contract address (set after deploy):</p>
          <input
            type="text"
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              fontFamily: "var(--font)",
            }}
          />
          {loading && (
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>Verifying…</p>
          )}
          <button className="primary" onClick={verifyOnChain} disabled={loading}>
            {loading ? "Checking…" : "Verify on chain"}
          </button>
          {onChain && (
            <div style={{ marginTop: "1rem" }}>
              {onChain.error && <p className="invalid">{onChain.error}</p>}
              {onChain.found ? (
                <>
                  <p className="valid"><strong>✓ Anchored on chain</strong></p>
                  <p>Score (on-chain): {onChain.score}</p>
                  <p>Timestamp: {onChain.timestamp}</p>
                  <p className="mono">Author: {onChain.author}</p>
                  <p>
                    <a href={`${selectedChain.explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">
                      View on explorer
                    </a>
                  </p>
                </>
              ) : (
                !onChain.error && <p className="invalid">This fingerprint is not anchored on chain.</p>
              )}
            </div>
          )}

          <button onClick={reset} style={{ marginTop: "1.5rem" }}>Verify another</button>
        </div>
      )}
    </>
  );
}
