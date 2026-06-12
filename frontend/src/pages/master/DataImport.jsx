import { useState } from "react";

const BACKEND = "https://gst-manufacturing-backend.onrender.com";

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
    <div style={{ padding: "24px", maxWidth: "720px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        Data Import
      </h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Import items, vendors, and customers from an Excel file. Download the
        template below to see the required format.
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
            <p>Vendors added: {result.vendors}</p>
            <p>Customers added: {result.customers}</p>
            <p>Workers added: {result.workers}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}