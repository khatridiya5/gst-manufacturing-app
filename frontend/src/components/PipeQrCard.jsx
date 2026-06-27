import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function PipeQrCard({ record }) {
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
    }
  };

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", textAlign: "center", background: "#fff" }}>
      <canvas ref={canvasRef} style={{ width: "100%", maxWidth: "120px" }} />
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