import { useEffect, useState } from 'react'
import api from '../../api/client'

const StatusBadge = ({ status }) => {
  const colors = {
    draft: 'bg-slate-100 text-slate-600',
    approved: 'bg-green-50 text-green-700',
    received: 'bg-teal-50 text-teal-700',
    cancelled: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export default function PurchaseOrders() {
  const [pos, setPOs] = useState([])
  const [vendors, setVendors] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [qrModal, setQrModal] = useState(null)
  const [qrCodes, setQrCodes] = useState([])
  const role = localStorage.getItem('role')

  // Form state
  const [vendorId, setVendorId] = useState('')
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0])
  const [lineItems, setLineItems] = useState([{ item_id: '', quantity: '', unit_price: '' }])

  const fetchPOs = async () => {
    try {
      const [posRes, vendorsRes, itemsRes] = await Promise.all([
        api.get('/purchase/po'),
        api.get('/master/vendors'),
        api.get('/master/items'),
      ])
      setPOs(posRes.data)
      setVendors(vendorsRes.data)
      setItems(itemsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPOs() }, [])

  const handleAddLine = () => {
    setLineItems([...lineItems, { item_id: '', quantity: '', unit_price: '' }])
  }

  const handleLineChange = (i, field, value) => {
    const updated = [...lineItems]
    updated[i][field] = value
    setLineItems(updated)
  }

  const handleRemoveLine = (i) => {
    setLineItems(lineItems.filter((_, idx) => idx !== i))
  }

  const handleCreatePO = async (e) => {
    e.preventDefault()
    try {
      await api.post('/purchase/po', {
        vendor_id: parseInt(vendorId),
        po_date: poDate,
        line_items: lineItems.map(li => ({
          item_id: parseInt(li.item_id),
          quantity: parseInt(li.quantity),
          unit_price: parseFloat(li.unit_price),
        }))
      })
      setShowForm(false)
      setVendorId('')
      setLineItems([{ item_id: '', quantity: '', unit_price: '' }])
      fetchPOs()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error creating PO')
    }
  }

  const handleApprove = async (poId) => {
    try {
      await api.patch(`/purchase/po/${poId}/approve`)
      fetchPOs()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error approving PO')
    }
  }

  const handleReceive = async (poId) => {
    try {
      await api.patch(`/purchase/po/${poId}/receive`)
      fetchPOs()
      handleViewQR(poId)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error receiving PO')
    }
  }

  const handleViewQR = async (poId) => {
    try {
      const res = await api.get(`/purchase/po/${poId}/qr-codes`)
      setQrCodes(res.data)
      setQrModal(poId)
    } catch (err) {
      console.error(err)
    }
  }
  const handleDelete = async (poId, poNumber) => {
  if (!confirm(`Delete ${poNumber}? This cannot be undone.`)) return
  try {
    await api.delete(`/purchase/po/${poId}`)
    fetchPOs()
  } catch (err) {
    alert(err.response?.data?.detail || 'Error deleting PO')
  }
}

  const handlePrint = () => {
    window.print()
  }

  const getVendorName = (id) => vendors.find(v => v.id === id)?.name || '—'

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{pos.length} total orders</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New PO
        </button>
      </div>

      {/* Create PO Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Create Purchase Order</h2>
          <form onSubmit={handleCreatePO} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Vendor</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                >
                  <option value="">Select vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">PO Date</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Items</label>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <select
                      value={li.item_id}
                      onChange={(e) => handleLineChange(i, 'item_id', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    >
                      <option value="">Select item...</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={li.quantity}
                      onChange={(e) => handleLineChange(i, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Unit Price (₹)"
                      value={li.unit_price}
                      onChange={(e) => handleLineChange(i, 'unit_price', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(i)}
                      className="px-3 py-2 text-red-400 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="mt-2 text-sm text-teal-600 hover:text-teal-500"
              >
                + Add item
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
              >
                Create PO
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PO Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3 text-left">PO Number</th>
                <th className="px-5 py-3 text-left">Vendor</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No purchase orders yet. Create your first PO.
                  </td>
                </tr>
              )}
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{po.po_number}</td>
                  <td className="px-5 py-3 text-slate-600">{getVendorName(po.vendor_id)}</td>
                  <td className="px-5 py-3 text-slate-500">{po.po_date}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-700">
                    ₹{Number(po.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <td className="px-5 py-3 text-center">
  <div className="flex items-center justify-center gap-2">
    {po.status === 'draft' && role === 'admin' && (
      <button
        onClick={() => handleApprove(po.id)}
        className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
      >
        Approve
      </button>
    )}
    {po.status === 'approved' && (
      <button
        onClick={() => handleReceive(po.id)}
        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium transition-colors"
      >
        Mark Received
      </button>
    )}
    {po.status === 'received' && (
      <button
        onClick={() => handleViewQR(po.id)}
        className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors"
      >
        View QR Codes
      </button>
    )}
    {role === 'admin' && (
      <button
        onClick={() => handleDelete(po.id, po.po_number)}
        className="px-3 py-1 border border-red-300 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium transition-colors"
      >
        Delete
      </button>
    )}
  </div>
</td>
                      {po.status === 'draft' && role === 'admin' && (
                        <button
                          onClick={() => handleApprove(po.id)}
                          className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {po.status === 'approved' && (
                        <button
                          onClick={() => handleReceive(po.id)}
                          className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          Mark Received
                        </button>
                      )}
                      {po.status === 'received' && (
                        <button
                          onClick={() => handleViewQR(po.id)}
                          className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          View QR Codes
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">
                QR Codes — PO #{qrModal} ({qrCodes.length} parts)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
                >
                  🖨️ Print All
                </button>
                <button
                  onClick={() => { setQrModal(null); setQrCodes([]) }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4 print:grid-cols-4">
              {qrCodes.map((part, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 text-center">
                  <img
                    src={`data:image/png;base64,${part.qr_code_image}`}
                    alt={part.serial_number}
                    className="w-full mb-2"
                  />
                  <p className="text-xs font-mono text-slate-600 break-all">{part.serial_number}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs ${
                    part.status === 'in_stock' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {part.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}