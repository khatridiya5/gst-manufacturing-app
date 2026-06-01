import { useEffect, useState } from "react";
import api from '../../api/client'

export default function IssueItems() {
  const [workers, setWorkers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false);
  const [issueDateTime, setIssueDateTime] = useState("");
  const [productRows, setProductRows] = useState([{ id: 1, item: null, qty: "", itemSearch: "", dropdownOpen: false }]);
  const [issueLog, setIssueLog] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setIssueDateTime(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
    fetchWorkers();
    fetchStock();
    fetchIssueLog();
  }, []);

  const fetchWorkers = async () => {
    try {
      const res = await api.get("/workers/");
      setWorkers(Array.isArray(res.data) ? res.data : res.data.workers || res.data.data || []);
    } catch {
      setWorkers([]);
    }
  };
  
  const fetchStock = async () => {
    try {
      const res = await api.get("/inventory/in-store");
      const data = Array.isArray(res.data) ? res.data : [];
      // map to consistent shape the product search expects
      setStockItems(data.map(i => ({
        id: i.item_id,
        name: i.name,
        unit: i.unit || "",
        current_stock: i.in_stock,
      })));
    } catch {
      setStockItems([]);
    }
  };
  
  const fetchIssueLog = async () => {
    try {
      const res = await api.get("/issue-items");
      setIssueLog(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch {
      setIssueLog([]);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(workerSearch.toLowerCase())
  );

  const addProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      { id: Date.now(), item: null, qty: "", itemSearch: "", dropdownOpen: false },
    ]);
  };

  const removeProductRow = (id) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    setProductRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const selectItem = (rowId, item) => {
    setProductRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, item, itemSearch: item.name, dropdownOpen: false }
          : r
      )
    );
  };

  const clearForm = () => {
    setSelectedWorker(null);
    setWorkerSearch("");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setIssueDateTime(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
    setProductRows([{ id: 1, item: null, qty: "", itemSearch: "", dropdownOpen: false }]);
  };

  const submitIssue = async () => {
    if (!selectedWorker) { showToast("Please select a worker.", "error"); return; }
    if (!issueDateTime) { showToast("Please set date and time.", "error"); return; }

    const products = productRows.filter((r) => r.item && r.qty && parseInt(r.qty) > 0);
    if (products.length === 0) {
      showToast("Add at least one product with valid quantity.", "error");
      return;
    }

    setLoading(true);
    try {
        await api.post("/issue-items", {
        worker_id: selectedWorker.id,
        issued_at: new Date(issueDateTime).toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata"
          }),
        items: products.map((r) => ({
          stock_item_id: r.item.id,
          quantity: parseInt(r.qty),
        })),
      });
      showToast("Items issued successfully!");
      clearForm();
      fetchIssueLog();
      fetchStock();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Failed to record issue.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const initials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === "error" ? "bg-red-500" : "bg-green-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Issue Items</h1>
        <p className="text-sm text-gray-500 mt-1">Issue store items to workers for production use</p>
      </div>

      {/* New Issue Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="text-gray-400">📦</span> New Issue
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Worker Selector */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Worker
            </label>
            <div
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white flex items-center justify-between"
              onClick={() => setWorkerDropdownOpen((v) => !v)}
            >
              {selectedWorker ? (
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                    {initials(selectedWorker.name)}
                  </span>
                  {selectedWorker.name}
                </span>
              ) : (
                <span className="text-gray-400">— Select worker —</span>
              )}
              <span className="text-gray-400 text-xs">▼</span>
            </div>
            {workerDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Search worker..."
                    className="w-full text-sm px-2 py-1 outline-none"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredWorkers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">No workers found</p>
                  ) : (
                    filteredWorkers.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                        onClick={() => {
                          setSelectedWorker(w);
                          setWorkerDropdownOpen(false);
                          setWorkerSearch("");
                        }}
                      >
                        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {initials(w.name)}
                        </span>
                        <div>
                          <p className="font-medium text-gray-800">{w.name}</p>
                          {w.role && <p className="text-xs text-gray-400">{w.role}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Issue Date & Time
            </label>
            <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600">
            {new Date(issueDateTime).toLocaleString("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
  timeZone: "Asia/Kolkata",
  hour12: true
})}
</div>
          </div>
        </div>

        {/* Product Rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</label>
            <button
              onClick={addProductRow}
              className="flex items-center gap-1 text-sm text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1 hover:bg-emerald-50 transition"
            >
              + Add product
            </button>
          </div>

          <div className="space-y-2">
            {productRows.map((row) => {
              const filteredItems = stockItems.filter((s) =>
                s.name.toLowerCase().includes(row.itemSearch.toLowerCase())
              );
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2"
                >
                  {/* Product search/select */}
                  <div className="col-span-6 relative">
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={row.itemSearch}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      onChange={(e) => {
                        updateRow(row.id, "itemSearch", e.target.value);
                        updateRow(row.id, "item", null);
                        updateRow(row.id, "dropdownOpen", true);
                      }}
                      onFocus={() => updateRow(row.id, "dropdownOpen", true)}
                    />
                    {row.dropdownOpen && row.itemSearch && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredItems.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-2">Not found</p>
                        ) : (
                          filteredItems.map((item) => (
                            <div
                              key={item.id}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm flex justify-between items-center"
                              onMouseDown={() => selectItem(row.id, item)}
                            >
                              <span className="font-medium text-gray-800">{item.name}</span>
                              <span className="text-xs text-gray-400">
                              {item.current_stock} {item.unit} in stock
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  {/* Unit badge */}
                  <div className="col-span-2 text-center">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                      {row.item ? row.item.unit : "—"}
                    </span>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeProductRow(row.id)}
                      className="text-gray-300 hover:text-red-500 text-lg transition"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={clearForm}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            Clear
          </button>
          <button
            onClick={submitIssue}
            disabled={loading}
            className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? "Saving..." : "✓ Record Issue"}
          </button>
        </div>
      </div>

      {/* Issue Log */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="text-gray-400">🕓</span> Issue Log
        </h2>

        {issueLog.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No issues recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-2 pr-4 w-6"></th>
                  <th className="pb-2 pr-4">Worker</th>
                  <th className="pb-2 pr-4">Products</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 text-right">Total items</th>
                </tr>
              </thead>
              <tbody>
                {issueLog.map((issue) => {
                  const isExpanded = expandedRows.includes(issue.id);
                  return (
                    <>
                      <tr
                        key={issue.id}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => toggleExpand(issue.id)}
                      >
                        <td className="py-3 pr-4 text-gray-300 text-xs">
                          {isExpanded ? "▼" : "▶"}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {initials(issue.worker_name)}
                            </span>
                            <span className="font-medium text-gray-800">{issue.worker_name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {issue.items.slice(0, 3).map((item, i) => (
                              <span
                                key={i}
                                className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full"
                              >
                                {item.item_name}
                              </span>
                            ))}
                            {issue.items.length > 3 && (
                              <span className="text-xs text-gray-400 px-1 py-0.5">
                                +{issue.items.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{formatDate(issue.issued_at)}</td>
                        <td className="py-3 pr-4 text-gray-400">{formatTime(issue.issued_at)}</td>
                        <td className="py-3 text-right font-semibold text-gray-700">
                          {issue.items.reduce((s, i) => s + i.quantity, 0)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${issue.id}-expand`} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                              Items issued to {issue.worker_name}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {issue.items.map((item, i) => (
                                <div
                                  key={i}
                                  className="bg-white border border-gray-100 rounded-lg px-3 py-2"
                                >
                                  <p className="text-xs text-gray-400">{item.item_name}</p>
                                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                                    {item.quantity}{" "}
                                    <span className="font-normal text-gray-400 text-xs">
                                      {item.unit}
                                    </span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}