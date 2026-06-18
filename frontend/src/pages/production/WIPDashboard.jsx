import { useEffect, useState } from "react"
import api from "../../api/client"

function ScanTypeBadge({ type }) {
  const styles = { start: "bg-emerald-100 text-emerald-800", end: "bg-red-100 text-red-800", pause: "bg-amber-100 text-amber-800" }
  const dots = { start: "bg-emerald-500", end: "bg-red-500", pause: "bg-amber-500" }
  const cls = styles[type] ?? "bg-slate-100 text-slate-700"
  const dot = dots[type] ?? "bg-slate-400"
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {type ?? "—"}
    </span>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export default function WIPDashboard() {
  const [scans, setScans] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const section = localStorage.getItem('active_section') || 'admin'
  const role = localStorage.getItem(`role_${section}`)

  const loadWIP = async () => {
    try {
      const res = await api.get("/production/wip")
      setScans(res.data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadWIP()
    const interval = setInterval(loadWIP, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (scanId) => {
    if (!confirm("Delete this scan record? This cannot be undone.")) return
    try {
      await api.delete(`/production/wip/${scanId}`)
      loadWIP()
    } catch (err) {
      alert(err.response?.data?.detail || "Error deleting scan")
    }
  }

  const activeWorkers = new Set(scans.map(s => s.worker_id)).size
  const activeStations = new Set(scans.map(s => s.workstation).filter(Boolean)).size
  const totalPartsTaken = scans.reduce((sum, s) => sum + (s.quantity ?? 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">WIP Tracking Dashboard</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live · refreshes every 3s
            {lastUpdated && (
              <span className="text-xs text-slate-400">· last updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
  <StatCard label="Active scans" value={scans.length} />
  <StatCard label="Workers on floor" value={activeWorkers} />
  <StatCard label="Stations active" value={activeStations} />
  <StatCard
    label="Last scan"
    value={scans.length > 0 ? new Date(scans[0].scanned_at + "Z").toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"}
  />
  <StatCard label="Parts taken" value={totalPartsTaken} />
</div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Worker</th>

              <th className="px-4 py-3 text-left">Part instance</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left">Scan type</th>
              <th className="px-4 py-3 text-left">Workstation</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Scanned at</th>
              {role === 'admin' && <th className="px-4 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No scans recorded yet</td>
              </tr>
            ) : (
              scans.map((scan) => (
                <tr key={scan.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium flex items-center justify-center flex-shrink-0">
                        {scan.worker_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{scan.worker_name}</p>
                        <p className="text-xs text-slate-400">{scan.worker_department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">{scan.part_code ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{scan.quantity ?? "—"}</td>
                  <td className="px-4 py-3"><ScanTypeBadge type={scan.scan_type} /></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{scan.workstation ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{scan.duration_minutes != null ? `${scan.duration_minutes} min` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(scan.scanned_at + "Z").toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </td>
                  {role === 'admin' && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(scan.id)}
                        className="px-3 py-1 border border-red-300 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}