import { useState } from "react";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";  // npm install qrcode
import PipeQrCard from "../../components/PipeQrCard";

const BACKEND = "https://gst-manufacturing-backend.onrender.com";

// ASSUMPTION: the backend's generate_qr_base64() returns a raw base64
// PNG string with no "data:image/..." prefix. If your QR images already
// render elsewhere in the app (e.g. on the Worker QR badge), check what
// prefix (if any) that code uses and match it here.
const qrSrc = (base64) => `data:image/png;base64,${base64}`;


function PipeQrCard({ record }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (record.pipeQrData && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, record.pipeQrData, { width: 120, margin: 2 });
    }
  }, [record.pipeQrData]);

  const handleDownload = () => {
    if (record.pipeQrData && canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${record.downloadName}.png`;
      a.click();
    } else {
      const a = document.createElement("a");
      a.href = qrSrc(record.qr_code_image);
      a.download = `${record.downloadName}.png`;
      a.click();
    }
  };

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", textAlign: "center", background: "#fff" }}>
      {record.pipeQrData
        ? <canvas ref={canvasRef} style={{ width: "100%", maxWidth: "120px" }} />
        : <img src={qrSrc(record.qr_code_image)} alt={record.displayName} style={{ width: "100%", maxWidth: "120px" }} />
      }
      <div style={{ marginTop: "8px", fontSize: "12px", fontWeight: 600 }}>{record.displayName}</div>
      {record.serial && (
        <div style={{ fontSize: "11px", color: "#64748b" }}>#{record.serial}</div>
      )}
      <button onClick={handleDownload} style={{ marginTop: "8px", fontSize: "12px", color: "#16a34a", background: "none", border: "none", cursor: "pointer" }}>
        ↓ Download
      </button>
    </div>
  );
}

function QrGrid({ title, records }) {
  if (!records || records.length === 0) return null;

  // Expand pipe items into one card per physical pipe
  const expanded = [];
  records.forEach((r) => {
    const qty = r.quantity || 1;
    const isPipe = r.name?.toUpperCase().startsWith("PIPE");
    if (isPipe && qty > 1) {
      for (let i = 1; i <= qty; i++) {
        const serial = String(i).padStart(4, "0");
        // Generate QR for PIPE-{id}-{serial} client-side as a canvas
        expanded.push({
          ...r,
          displayName: r.name,
          serial: serial,
          pipeQrData: `PIPE-${r.item_id}-${serial}`,
          downloadName: `${(r.name).replace(/\s+/g, "_")}_${serial}_QR`,
        });
      }
    } else {
      expanded.push({ ...r, displayName: r.name, downloadName: `${(r.code || r.name).replace(/\s+/g, "_")}_QR` });
    }
  });

  return (
    <div style={{ marginTop: "24px" }}>
      <h3 style={{ marginBottom: "12px", fontSize: "16px" }}>
        {title} ({expanded.length} QR codes)
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" }}>
        {expanded.map((r, i) => (
          <PipeQrCard key={i} record={r} />
        ))}
      </div>
    </div>
  );
}

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleDownloadTemplate = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/import/template`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_template.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND}/import/excel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Import failed");
      } else {
        setResult(data.summary);
      }
    } catch (e) {
      setError("Network error — check connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        Data Import
      </h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Import items, vendors, customers, and workers from an Excel file.
        Download the template below to see the required format. You can
        re-upload the same file later — existing records are updated, not
        duplicated, and stock won't double-count.
      </p>

      <button
        onClick={handleDownloadTemplate}
        style={{
          padding: "10px 18px",
          background: "#0f172a",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ↓ Download Template
      </button>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px",
          background: "#fff",
        }}
      >
        <label
          htmlFor="excel-file-input"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "16px",
          }}
        >
          {file ? file.name : "Choose Excel File"}
        </label>
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ display: "none" }}
        />
        <br />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            padding: "10px 24px",
            background: file ? "#16a34a" : "#94a3b8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: file ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Importing..." : "Import"}
        </button>

        {error && (
          <div style={{ marginTop: "16px", color: "#dc2626" }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ marginBottom: "8px" }}>Import Summary</h3>
            <p>Items added/updated: {result.items}</p>
            <p>Vendors added/updated: {result.vendors}</p>
            <p>Customers added/updated: {result.customers}</p>
            <p>Workers added/updated: {result.workers}</p>
            <p>QR codes generated: {result.qr_generated}</p>
            <p>Skipped rows: {result.skipped}</p>
            {result.errors.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <strong style={{ color: "#dc2626" }}>Errors:</strong>
                <ul>
                  {result.errors.map((e, i) => (
                    <li key={i} style={{ fontSize: "13px", color: "#dc2626" }}>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <QrGrid title="Item QR Codes" records={result.items_detail} />
            <QrGrid title="Worker QR Codes" records={result.workers_detail} />
          </div>
        )}
      </div>
    </div>
  );
}