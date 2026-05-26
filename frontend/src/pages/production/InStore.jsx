import { useEffect, useState } from "react";
import api from "../../api/client";

const LOW_STOCK_THRESHOLD = 0.2;

export default function InStore() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const interval = setInterval(fetchItems, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleRowClick = async (item) => {
    if (selected?.item_id === item.item_id) {
      setSelected(null);
      setScanHistory([]);
      return;
    }
    setSelected(item);
    const res = await api.get(`/api/inventory/in-store/${item.item_id}/scans`);
    setScanHistory(res.data);
  };

  const lowStockItems = Array.isArray(items) ? items.filter((i) => i.low_stock) : [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">In-Store Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Stock updates from received POs · Deducted on worker start scans
        </p>
      </div>

      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-red-500 font-semibold text-sm">⚠ Low Stock:</span>
          <span className="text-red-700 text-sm">
            {lowStockItems.map((i) => i.name).join(", ")}
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Items" value={items.length} />
        <StatCard
          label="Total In Stock"
          value={items.reduce((s, i) => s + i.in_stock, 0)}
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStockItems.length}
          highlight={lowStockItems.length > 0}
        />
      </div>

      {/* Main table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Item", "Part Code", "Received", "Consumed", "In Stock", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No items found. Mark a Purchase Order as received to populate.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <>
                  <tr
                    key={item.item_id}
                    onClick={() => handleRowClick(item)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selected?.item_id === item.item_id
                        ? "bg-teal-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-gray-800">{item.name}</td>
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs">{item.part_code}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_received}</td>
                    <td className="px-5 py-4 text-gray-700">{item.total_consumed}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{item.in_stock}</td>
                    <td className="px-5 py-4">
                      {item.low_stock ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Inline scan history expansion */}
                  {selected?.item_id === item.item_id && (
                    <tr key={`${item.item_id}-history`}>
                      <td colSpan={6} className="px-5 py-4 bg-teal-50 border-b border-teal-100">
                        <p className="text-xs font-semibold text-teal-700 mb-2 uppercase tracking-wide">
                          Recent Scans — {item.name}
                        </p>
                        {scanHistory.length === 0 ? (
                          <p className="text-xs text-gray-400">No scans yet.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left pb-1">Worker</th>
                                <th className="text-left pb-1">Part Instance</th>
                                <th className="text-left pb-1">Scanned At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scanHistory.map((s, i) => (
                                <tr key={i} className="text-gray-700">
                                  <td className="py-1">{s.worker}</td>
                                  <td className="py-1 font-mono">{s.part_instance}</td>
                                  <td className="py-1">{new Date(s.scanned_at).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Received vs Consumed bar chart */}
      <ReceivedVsConsumed items={items} />
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm ${highlight ? "border-red-200" : "border-gray-100"}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-red-600" : "text-gray-800"}`}>
        {value}
      </p>
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
              {/* Received bar (background) */}
              <div
                className="absolute h-3 bg-teal-100 rounded-full"
                style={{ width: `${(item.total_received / maxVal) * 100}%` }}
              />
              {/* Consumed bar (foreground) */}
              <div
                className="absolute h-3 bg-teal-500 rounded-full"
                style={{ width: `${(item.total_consumed / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-100 rounded-full inline-block"/> Received</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-500 rounded-full inline-block"/> Consumed</span>
      </div>
    </div>
  );
}