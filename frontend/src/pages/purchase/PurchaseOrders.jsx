import { useEffect, useState } from 'react'
import api from '../../api/client'
import DeleteConfirmModal from '../../components/DeleteConfirmModal'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const utcIso = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

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
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [qrModal, setQrModal] = useState(null)
  const [qrCodes, setQrCodes] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expandedPO, setExpandedPO] = useState(null)
  const [poItems, setPoItems] = useState({})
  const [receivingId, setReceivingId] = useState(null)
  const [sortOrder, setSortOrder] = useState('newest')
  const role = localStorage.getItem('role')
  const [payModal, setPayModal] = useState(null) // { id, po_number, total, paid }
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')

  // form state
  const [vendorId, setVendorId] = useState('')
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0])
  const [trackQr, setTrackQr] = useState(false)
  const [lineItems, setLineItems] = useState([{ item_name: '', quantity: '', unit_price: '' }])

  const fetchPOs = async () => {
    try {
      const [posRes, vendorsRes] = await Promise.all([
        api.get('/purchase/po'),
        api.get('/master/vendors'),
      ])
      setPOs(posRes.data)
      setVendors(vendorsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPOs() }, [])

  const handleAddLine = () => setLineItems([...lineItems, { item_name: '', quantity: '', unit_price: '' }])

  const handleLineChange = (i, field, value) => {
    const updated = [...lineItems]
    updated[i][field] = value
    setLineItems(updated)
  }

  const handleRemoveLine = (i) => setLineItems(lineItems.filter((_, idx) => idx !== i))

  const handleCreatePO = async (e) => {
    e.preventDefault()
    try {
      await api.post('/purchase/po', {
        vendor_id: parseInt(vendorId),
        po_date: poDate,
        track_qr: trackQr,
        line_items: lineItems.map(li => ({
          item_name: li.item_name,
          quantity: parseInt(li.quantity),
          unit_price: parseFloat(li.unit_price),
          tax_rate: parseFloat(li.tax_rate) || 0,
        }))
      })
      setShowForm(false)
      setVendorId('')
      setTrackQr(false)
      setLineItems([{ item_name: '', quantity: '', unit_price: '' }])
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

  const handleReceive = async (poId, trackQrFlag) => {
    setReceivingId(poId)
    try {
      await api.patch(`/purchase/po/${poId}/receive`)
      fetchPOs()
      if (trackQrFlag) handleViewQR(poId)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error receiving PO')
    } finally {
      setReceivingId(null)
    }
  }

  const handleViewQR = async (poId) => {
    try {
      const res = await api.get(`/purchase/po/${poId}/qr-codes`)
      setQrCodes(Array.isArray(res.data) ? res.data : res.data.parts || [])
      setQrModal(poId)
    } catch (err) {
      console.error(err)
    }
  }

  const handleExpandPO = async (poId) => {
    if (expandedPO === poId) {
      setExpandedPO(null)
      return
    }
    try {
      const res = await api.get(`/purchase/po/${poId}/items`)
      setPoItems(prev => ({ ...prev, [poId]: res.data }))
      setExpandedPO(poId)
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkPaid = async () => {
  try {
    await api.post(`/purchase/po/${payModal.id}/pay`, {
      amount: parseFloat(payAmount),
      note: payNote
    })
    setPayModal(null)
    setPayAmount('')
    setPayNote('')
    fetchPOs()
  } catch (err) {
    alert(err.response?.data?.detail || 'Error')
  }
}

  const handleDelete = async (otp) => {
    try {
      await api.delete(`/purchase/po/${deleteTarget.id}?otp=${otp}`)
      setDeleteTarget(null)
      fetchPOs()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting PO')
    }
  }

  const getVendorName = (id) => vendors.find(v => v.id === id)?.name || '—'
  const sortedPOs = [...pos].sort((a, b) =>
  sortOrder === 'newest'
    ? new Date(b.created_at) - new Date(a.created_at)
    : new Date(a.created_at) - new Date(b.created_at)
)



  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
    <p className="text-slate-500 text-sm mt-1">{pos.length} total orders</p>
  </div>
  <div className="flex items-center gap-3">
    <select
      value={sortOrder}
      onChange={(e) => setSortOrder(e.target.value)}
      className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-teal-500"
    >
      <option value="newest">Newest First</option>
      <option value="oldest">Oldest First</option>
    </select>
    <button
      onClick={() => setShowForm(!showForm)}
      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
    >
      + New PO
    </button>
  </div>
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

            {/* QR Tracking Toggle */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setTrackQr(!trackQr)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  trackQr ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  trackQr ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  QR Code Tracking
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    trackQr ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {trackQr ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {trackQr
                    ? 'A QR code will be generated for each unit received'
                    : 'Stock will be updated without individual QR codes'}
                </p>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Items</label>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Material name"
                    value={li.item_name}
                    onChange={(e) => handleLineChange(i, 'item_name', e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Part code (optional)"
                    value={li.part_code || ''}
                    onChange={(e) => handleLineChange(i, 'part_code', e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  />
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
                  <input
                    type="number"
                    placeholder="Tax % (e.g. 18)"
                    value={li.tax_rate || ''}
                    onChange={(e) => handleLineChange(i, 'tax_rate', e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
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
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">
                Create PO
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PO List - Grouped by Vendor */}
<div className="space-y-4">
  {Object.entries(
    sortedPOs.reduce((groups, po) => {
      const vendorName = getVendorName(po.vendor_id)
      if (!groups[vendorName]) groups[vendorName] = []
      groups[vendorName].push(po)
      return groups
    }, {})
  ).map(([vendorName, vendorPOs]) => (
    <div key={vendorName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Vendor Header */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">
            {vendorName[0]}
          </div>
          <span className="font-semibold text-slate-700">{vendorName}</span>
          <span className="text-xs text-slate-400">{vendorPOs.length} order{vendorPOs.length > 1 ? 's' : ''}</span>
        </div>
        <span className="text-sm font-semibold text-slate-600">
          ₹{vendorPOs.reduce((sum, po) => sum + Number(po.total_amount), 0).toLocaleString('en-IN')}
        </span>
      </div>

      {/* POs under this vendor */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs uppercase border-b border-slate-100">
            <th className="px-5 py-2 text-left">PO Number</th>
            <th className="px-5 py-2 text-left">Created</th>
            <th className="px-5 py-2 text-left">Received</th>
            <th className="px-5 py-2 text-right">Amount</th>
            <th className="px-5 py-2 text-center">QR</th>
            <th className="px-5 py-2 text-center">Status</th>
            <th className="px-5 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {vendorPOs.map((po) => (
            <>
              <tr
                key={po.id}
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => handleExpandPO(po.id)}
              >
                <td className="px-5 py-3 font-medium text-slate-700">
                  <span className="text-slate-400 text-xs mr-2">{expandedPO === po.id ? '▼' : '▶'}</span>
                  {po.po_number}
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{fmtDateTime(po.created_at)}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{fmtDateTime(po.received_at)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-700">
                  ₹{Number(po.total_amount).toLocaleString('en-IN')}
                </td>
                <td className="px-5 py-3 text-center">
                  {po.track_qr ? (
                    <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium">QR</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-xs">No QR</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <StatusBadge status={po.status} />
                </td>
                <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-2">
                    {po.status === 'draft' && role === 'admin' && (
                      <button onClick={() => handleApprove(po.id)}
                        className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        Approve
                      </button>
                    )}
                    {po.status === 'approved' && (
                      <button onClick={() => handleReceive(po.id, po.track_qr)}
                        disabled={receivingId === po.id}
                        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium disabled:opacity-50">
                        {receivingId === po.id ? 'Receiving...' : 'Mark Received'}
                      </button>
                    )}
                    {po.status === 'received' && po.track_qr && (
                      <button onClick={() => handleViewQR(po.id)}
                        className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium">
                        View QR Codes
                      </button>
                    )}
                    {/* Payment summary */}
{po.status === 'received' && (
  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-6 text-xs">
    <span className="text-slate-500">Total: <strong className="text-slate-700">₹{Number(po.total_amount).toLocaleString('en-IN')}</strong></span>
    <span className="text-slate-500">Paid: <strong className="text-emerald-600">₹{Number(po.amount_paid || 0).toLocaleString('en-IN')}</strong></span>
    <span className="text-slate-500">Balance: <strong className="text-red-500">₹{Number(po.balance || po.total_amount).toLocaleString('en-IN')}</strong></span>
    <span className={`px-2 py-0.5 rounded-full font-semibold ${
      po.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
      po.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' :
      'bg-red-50 text-red-600'
    }`}>{po.payment_status || 'unpaid'}</span>
  </div>
)}
                    {role === 'admin' && (
                      <button onClick={() => setDeleteTarget({ id: po.id, name: po.po_number })}
                        className="px-3 py-1 border border-red-300 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {/* Expanded line items */}
              {expandedPO === po.id && poItems[po.id] && (
                <tr key={`${po.id}-items`}>
                  <td colSpan={7} className="px-8 py-3 bg-slate-50 border-b border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 uppercase">
                          <th className="text-left py-1">Item</th>
                          <th className="text-right py-1">Qty</th>
                          <th className="text-right py-1">Unit Price</th>
                          <th className="text-right py-1">Tax %</th>
                          <th className="text-right py-1">Tax Amt</th>
                          <th className="text-right py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poItems[po.id].map((item, i) => {
                          const subtotal = item.quantity * parseFloat(item.unit_price)
                          const taxAmt = subtotal * (parseFloat(item.tax_rate || 0) / 100)
                          const total = subtotal + taxAmt
                          return (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-1.5 text-slate-700 font-medium">{item.item_name}</td>
                              <td className="py-1.5 text-right text-slate-600">{item.quantity}</td>
                              <td className="py-1.5 text-right text-slate-600">₹{item.unit_price}</td>
                              <td className="py-1.5 text-right text-slate-500">{item.tax_rate || 0}%</td>
                              <td className="py-1.5 text-right text-slate-500">₹{taxAmt.toFixed(2)}</td>
                              <td className="py-1.5 text-right font-semibold text-slate-700">₹{total.toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  ))}
</div>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">
                QR Codes — PO #{qrModal} ({qrCodes.length} parts)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
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
      {payModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-sm p-6">
      <h2 className="font-semibold text-slate-700 mb-1">Record Payment</h2>
      <p className="text-xs text-slate-400 mb-4">{payModal.name}</p>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Amount Paid (₹)</label>
          <input
            type="number"
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Note</label>
          <input
            type="text"
            value={payNote}
            onChange={e => setPayNote(e.target.value)}
            placeholder="e.g. Paid via NEFT for PO-0012"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleMarkPaid}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
          >Record Payment</button>
          <button
            onClick={() => setPayModal(null)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm"
          >Cancel</button>
        </div>
      </div>
    </div>
  </div>
)}

      {deleteTarget && (
        <DeleteConfirmModal
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}