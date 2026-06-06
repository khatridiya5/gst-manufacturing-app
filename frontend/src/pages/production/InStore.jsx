import { useEffect, useState } from "react";
import api from "../../api/client";

export default function InStore() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [vendorBreakdown, setVendorBreakdown] = useState([]);
  const [expandedVendors, setExpandedVendors] = useState({});
  const [loading, setLoading] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState({ item_id: "", quantity: "", reason: "" });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await api.get("/api/inventory/in-store");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSubmit = async () => {
    if (!manualForm.item_id || !manualForm.quantity) return;
    setManualSubmitting(true);
    try {
      await api.post("/api/inventory/in-store/manual-entry", {
        item_id: parseInt(manualForm.item_id),
        quantity: parseFloat(manualForm.quantity),
        reason: manualForm.reason,
      });
      setShowManualEntry(false);
      setManualForm({ item_id: "", quantity: "", reason: "" });
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to submit");
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleRowClick = async (item) => {
    if (selected?.item_id === item.item_id) {
      setSelected(null);
      setScanHistory([]);
      setVendorBreakdown([]);
      setExpandedVendors({});
      return;
    }
    setSelected(item);
    setExpandedVendors({});

    try {
      const [manualRes, vendorRes] = await Promise.all([
        api.get(`/api/inventory/in-store/${item.item_id}/manual-entries`),
        api.get(`/api/inventory/in-store/${item.item_id}/vendor-breakdown`),
      ]);
      setScanHistory(manualRes.data);
      setVendorBreakdown(vendorRes.data);
    } catch (e) {
      setScanHistory([]);
      setVendorBreakdown([]);
    }
  };

  const toggleVendor = (vendorName) => {
    setExpandedVendors((prev) => ({ ...prev, [vendorName]: !prev[vendorName] }));
  };

  const lowStockItems = items.filter((i) => i.low_stock);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">In-Store Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Stock updates from received POs · Deducted on worker start scans
          </p>
        </div>
        <button
          onClick={() => setShowManualEntry(true)}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition"
        >
          + Manual Entry
        </button>
      </div>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Manual Stock Entry</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Item</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={manualForm.item_id}
                  onChange={(e) => setManualForm({ ...manualForm, item_id: e.target.value })}
                >
                  <option value="">Select item...</option>
                  {items.map((i) => (
                    <option key={i.item_id} value={i.item_id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Quantity <span className="text-gray-400">(negative to deduct)</span>
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. 10 or -5"
                  value={manualForm.quantity}
                  onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
                />
                {manualForm.quantity && (
                  <p className={`text-xs mt-1 font-medium ${parseFloat(manualForm.quantity) > 0 ? "text-green-600" : "text-red-500"}`}>
                    {parseFloat(manualForm.quantity) > 0
                      ? `+${manualForm.quantity} units will be added`
                      : `${manualForm.quantity} units will be deducted`}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Reason <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. damaged, opening stock, correction"
                  value={manualForm.reason}
                  onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowManualEntry(false); setManualForm({ item_id: "", quantity: "", reason: "" }); }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualSubmitting || !manualForm.item_id || !manualForm.quantity}
                className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {manualSubmitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-red-500 font-semibold text-sm">⚠ Low Stock:</span>
          <span className="text-red-700 text-sm">{lowStockItems.map((i) => i.name).join(", ")}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Items" value={items.length} />
        <StatCard label="Total In Stock" value={items.reduce((s, i) => s + i.in_stock, 0)} />
        <StatCard label="Low Stock Alerts" value={lowStockItems.length} highlight={lowStockItems.length > 0} />
      </div>

      {/* Main table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Item", "Part Code", "Received", "Consumed", "In Stock", "Status", "Tracking"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No items found. Mark a Purchase Order as received to populate.</td></tr>
            ) : (
              items.map((item) => (
                <>
                  {/* Main item row */}
                  <tr
                    key={item.item_id}
                    onClick={() => handleRowClick(item)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selected?.item_id === item.item_id ? "bg-teal-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-gray-800 flex items-center gap-2">
                      <span className={`transition-transform text-gray-400 text-xs ${selected?.item_id === item.item_id ? "rotate-90" : ""}`}>▶</span>
                      {item.name.toUpperCase()}
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{item.part_code}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_received}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_consumed}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{item.in_stock}</td>
                    <td className="px-5 py-4">
                      {item.low_stock ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">Low Stock</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {item.track_qr ? (
                        <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium">QR</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-xs">Manual</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail panel */}
                  {selected?.item_id === item.item_id && (
                    <tr key={`${item.item_id}-detail`}>
                      <td colSpan={7} className="px-5 py-4 bg-teal-50 border-b border-teal-100">

                        {/* ── Vendor Breakdown ── */}
                        {vendorBreakdown.length > 0 && (
                          <div className="mb-5">
                            <p className="text-xs font-semibold text-teal-700 mb-2 uppercase tracking-wide">
                              Stock by Vendor — {item.name}
                            </p>
                            <div className="space-y-2">
                              {vendorBreakdown.map((v) => (
                                <div key={v.vendor} className="bg-white rounded-lg border border-teal-100 overflow-hidden">
                                  {/* Vendor header row — click to expand PO list */}
                                  <button
                                    onClick={() => toggleVendor(v.vendor)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`text-gray-400 text-xs transition-transform ${expandedVendors[v.vendor] ? "rotate-90" : ""}`}>▶</span>
                                      <span className="text-sm font-semibold text-gray-800">{v.vendor}</span>
                                      <span className="text-xs text-gray-400">{v.orders.length} order{v.orders.length !== 1 ? "s" : ""}</span>
                                    </div>
                                    <span className="text-sm font-bold text-teal-700">{v.total_qty} units</span>
                                  </button>

                                  {/* PO breakdown — shown when expanded */}
                                  {expandedVendors[v.vendor] && (
                                    <div className="border-t border-teal-50 px-4 pb-3 pt-2">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-gray-400">
                                            <th className="text-left pb-1 font-medium">PO Number</th>
                                            <th className="text-left pb-1 font-medium">Date Received</th>
                                            <th className="text-right pb-1 font-medium">Qty</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {v.orders.map((o, idx) => (
                                            <tr key={idx} className="text-gray-700 border-t border-gray-50">
                                              <td className="py-1.5 font-mono font-medium text-teal-700">{o.po_number}</td>
                                              <td className="py-1.5 text-gray-500">
                                                {new Date(o.date).toLocaleDateString("en-GB", {
                                                  day: "2-digit", month: "short", year: "numeric"
                                                })}
                                              </td>
                                              <td className="py-1.5 text-right font-semibold text-gray-800">{o.quantity}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Manual Entries ── */}
                        <div>
                          <p className="text-xs font-semibold text-teal-700 mb-2 uppercase tracking-wide">
                            Manual Entries — {item.name}
                          </p>
                          {scanHistory.length === 0 ? (
                            <p className="text-xs text-gray-400">No manual entries yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left pb-1">Date</th>
                                  <th className="text-left pb-1">Time</th>
                                  <th className="text-left pb-1">Quantity</th>
                                  <th className="text-left pb-1">Type</th>
                                  <th className="text-left pb-1">Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scanHistory.map((s, i) => (
                                  <tr key={i} className="text-gray-700">
                                    <td className="py-1">
                                      {new Date(s.transaction_date).toLocaleDateString("en-GB", {
                                        day: "2-digit", month: "short", year: "numeric"
                                      })}
                                    </td>
                                    <td className="py-1 text-gray-500">
                                      {s.created_at
                                        ? new Date(s.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
                                        : "—"}
                                    </td>
                                    <td className="py-1 font-semibold">
                                      <span className={s.transaction_type === "manual_in" ? "text-green-600" : "text-red-500"}>
                                        {s.transaction_type === "manual_in" ? "+" : "-"}{s.quantity}
                                      </span>
                                    </td>
                                    <td className="py-1">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        s.transaction_type === "manual_in"
                                          ? "bg-green-100 text-green-700"
                                          : "bg-red-100 text-red-600"
                                      }`}>
                                        {s.transaction_type === "manual_in" ? "Added" : "Deducted"}
                                      </span>
                                    </td>
                                    <td className="py-1 text-gray-400 italic">{s.reason || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ReceivedVsConsumed items={items} />
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm ${highlight ? "border-red-200" : "border-gray-100"}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-red-600" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function ReceivedVsConsumed({ items }) {
  if (items.length === 0) return null;
  const maxVal = Math.max(...items.map((i) => i.total_received));
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Received vs Consumed</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.item_id}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{item.name}</span>
              <span>{item.in_stock} remaining</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 relative overflow-hidden">
              <div className="absolute h-3 bg-teal-100 rounded-full" style={{ width: `${(item.total_received / maxVal) * 100}%` }} />
              <div className="absolute h-3 bg-teal-500 rounded-full" style={{ width: `${(item.total_consumed / maxVal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-100 rounded-full inline-block" /> Received</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-500 rounded-full inline-block" /> Consumed</span>
      </div>
    </div>
  );
}