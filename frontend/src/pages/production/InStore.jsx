import { useEffect, useState } from "react";
import api from "../../api/client";

export default function InStore() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dropdownData, setDropdownData] = useState({ vendors: [], manual: [] });
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
      setDropdownData({ vendors: [], manual: [] });
      return;
    }
    setSelected(item);
    setDropdownData({ vendors: [], manual: [] });

    try {
      const [manualRes, vendorRes] = await Promise.all([
        api.get(`/api/inventory/in-store/${item.item_id}/manual-entries`),
        api.get(`/api/inventory/in-store/${item.item_id}/vendor-breakdown`),
      ]);
      setDropdownData({ vendors: vendorRes.data, manual: manualRes.data });
    } catch (e) {
      setDropdownData({ vendors: [], manual: [] });
    }
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
                    {parseFloat(manualForm.quantity) > 0 ? `+${manualForm.quantity} units will be added` : `${manualForm.quantity} units will be deducted`}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Reason <span className="text-gray-400">(optional)</span></label>
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
              >Cancel</button>
              <button
                onClick={handleManualSubmit}
                disabled={manualSubmitting || !manualForm.item_id || !manualForm.quantity}
                className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >{manualSubmitting ? "Saving..." : "Submit"}</button>
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
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No items found.</td></tr>
            ) : (
              items.map((item) => (
                <>
                  <tr
                    key={item.item_id}
                    onClick={() => handleRowClick(item)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selected?.item_id === item.item_id ? "bg-teal-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-gray-800">
                      <span className={`inline-block mr-2 text-gray-400 text-xs transition-transform duration-200 ${selected?.item_id === item.item_id ? "rotate-90" : ""}`}>▶</span>
                      {item.name.toUpperCase()}
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{item.part_code}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_received}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_consumed}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{item.in_stock}</td>
                    <td className="px-5 py-4">
                      {item.low_stock
                        ? <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">Low Stock</span>
                        : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>}
                    </td>
                    <td className="px-5 py-4">
                      {item.track_qr
                        ? <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium">QR</span>
                        : <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-xs">Manual</span>}
                    </td>
                  </tr>

                  {/* ── Unified Dropdown ── */}
                  {selected?.item_id === item.item_id && (
                    <tr key={`${item.item_id}-dropdown`}>
                      <td colSpan={7} className="bg-teal-50 border-b border-teal-100 px-6 py-4">
                        <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3">
                          Stock Detail — {item.name.toUpperCase()}
                        </p>

                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-teal-100">
                              <th className="text-left pb-2 font-semibold">Source</th>
                              <th className="text-left pb-2 font-semibold">Reference</th>
                              <th className="text-left pb-2 font-semibold">Date</th>
                              <th className="text-right pb-2 font-semibold">Qty</th>
                              <th className="text-left pb-2 font-semibold pl-4">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Vendor rows */}
                            {dropdownData.vendors.length === 0 && dropdownData.manual.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-3 text-gray-400 italic">No stock history found.</td>
                              </tr>
                            )}

                            {dropdownData.vendors.flatMap((v) =>
                              v.orders.map((o, oi) => (
                                <tr key={`v-${v.vendor}-${oi}`} className="border-b border-teal-50">
                                  <td className="py-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                      🏭 {v.vendor}
                                    </span>
                                  </td>
                                  <td className="py-2 font-mono text-teal-700 font-semibold">{o.po_number}</td>
                                  <td className="py-2 text-gray-500">
                                    {new Date(o.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </td>
                                  <td className="py-2 text-right font-bold text-gray-800">+{o.quantity}</td>
                                  <td className="py-2 pl-4 text-gray-400">Purchase received</td>
                                </tr>
                              ))
                            )}

                            {/* Manual entry rows */}
                            {dropdownData.manual.map((m, mi) => (
                              <tr key={`m-${mi}`} className="border-b border-teal-50">
                                <td className="py-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                                    m.transaction_type === "manual_in"
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-600"
                                  }`}>
                                    {m.transaction_type === "manual_in" ? "✚ Manual Add" : "✖ Manual Deduct"}
                                  </span>
                                </td>
                                <td className="py-2 text-gray-400">—</td>
                                <td className="py-2 text-gray-500">
                                  {new Date(m.transaction_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  {m.created_at && (
                                    <span className="ml-1 text-gray-400">
                                      {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                    </span>
                                  )}
                                </td>
                                <td className={`py-2 text-right font-bold ${m.transaction_type === "manual_in" ? "text-green-600" : "text-red-500"}`}>
                                  {m.transaction_type === "manual_in" ? "+" : "-"}{m.quantity}
                                </td>
                                <td className="py-2 pl-4 text-gray-400 italic">{m.reason || "—"}</td>
                              </tr>
                            ))}
                          </tbody>

                          {/* Totals footer */}
                          {(dropdownData.vendors.length > 0 || dropdownData.manual.length > 0) && (
                            <tfoot>
                              <tr className="border-t-2 border-teal-200">
                                <td colSpan={3} className="pt-2 font-semibold text-gray-600">Total In Stock</td>
                                <td className="pt-2 text-right font-bold text-teal-700 text-sm">{item.in_stock}</td>
                                <td />
                              </tr>
                            </tfoot>
                          )}
                        </table>
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