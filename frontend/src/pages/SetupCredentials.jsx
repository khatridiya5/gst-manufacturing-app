import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const sections = [
  { key: "purchase", label: "Purchase", color: "#185FA5", bg: "#E6F1FB" },
  { key: "sales",    label: "Sales",    color: "#3B6D11", bg: "#EAF3DE" },
  { key: "production", label: "Production", color: "#854F0B", bg: "#FAEEDA" },
];

export default function SetupCredentials() {
  const navigate = useNavigate();
  const [forms, setForms] = useState({
    purchase:   { username: "", password: "" },
    sales:      { username: "", password: "" },
    production: { username: "", password: "" },
  });
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState("");

  const handleSave = async (section) => {
    const { username, password } = forms[section];
    if (!username || !password) { setError("Fill both fields"); return; }
    try {
      await api.post("/api/setup/section-credentials", null, {
        params: { section, username, password },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setSaved(prev => [...new Set([...prev, section])]);
      setError("");
    } catch {
      setError("Failed to save. Try again.");
    }
  };

  const allDone = sections.every(s => saved.includes(s.key));

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex",
      alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 480, padding: "0 1rem" }}>

        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 52, height: 52, background: "#1abc9c", borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <span style={{ color: "#fff", fontSize: 22 }}>⚙</span>
          </div>
          <h2 style={{ color: "#fff", margin: "0 0 6px", fontWeight: 600 }}>
            Set up section access
          </h2>
          <p style={{ color: "#8b9ab1", margin: 0, fontSize: 14 }}>
            Create login credentials for Purchase, Sales and Production workers.
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: "1.5rem" }}>
          {sections.map((s, i) => (
            <div key={i} style={{ height: 4, width: 40, borderRadius: 99,
              background: saved.includes(s.key) ? "#1abc9c" : "#2a3444" }} />
          ))}
        </div>

        {sections.map(({ key, label, color, bg }) => (
          <div key={key} style={{
            background: "#161b22", border: `${saved.includes(key) ? "2px solid #1abc9c" : "1px solid #2a3444"}`,
            borderRadius: 12, padding: "1.25rem", marginBottom: "1rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ background: bg, color, borderRadius: 8,
                padding: "4px 10px", fontSize: 13, fontWeight: 500 }}>
                {label}
              </span>
              {saved.includes(key) && (
                <span style={{ marginLeft: "auto", color: "#1abc9c", fontSize: 13 }}>✓ Saved</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {["username", "password"].map(field => (
                <div key={field}>
                  <label style={{ fontSize: 12, color: "#8b9ab1", display: "block", marginBottom: 4 }}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type={field === "password" ? "password" : "text"}
                    placeholder={field === "username" ? `${key}_user` : "••••••••"}
                    value={forms[key][field]}
                    onChange={e => setForms(f => ({
                      ...f, [key]: { ...f[key], [field]: e.target.value }
                    }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8,
                      border: "1px solid #2a3444", background: "#0d1117",
                      color: "#fff", fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
            <button onClick={() => handleSave(key)} style={{
              width: "100%", padding: "10px", background: "#1abc9c", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer"
            }}>
              Save {label} credentials
            </button>
          </div>
        ))}

        {error && <p style={{ color: "#e74c3c", textAlign: "center", fontSize: 13 }}>{error}</p>}

        {allDone && (
          <button onClick={() => navigate("/dashboard")} style={{
            width: "100%", padding: 12, background: "#1abc9c", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
            cursor: "pointer", marginTop: "0.5rem"
          }}>
            Go to Dashboard →
          </button>
        )}

        <p style={{ textAlign: "center", color: "#4a5568", fontSize: 13, marginTop: "1rem", cursor: "pointer" }}
          onClick={() => navigate("/dashboard")}>
          Skip for now — set up later in settings
        </p>
      </div>
    </div>
  );
}