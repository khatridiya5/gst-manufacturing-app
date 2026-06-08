import { useEffect, useState } from 'react'
import api from '../../api/client'
import DeleteConfirmModal from '../../components/DeleteConfirmModal'

const StatusBadge = ({ status }) => {
  const colors = {
    planned: 'bg-amber-50 text-amber-700',
    in_progress: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-600'
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export default function ProductionOrders() {
  const [orders, setOrders] = useState([])
  const [boms, setBoms] = useState([])
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBOMForm, setShowBOMForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [completeModal, setCompleteModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [qrCodes, setQrCodes] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [sortOrder, setSortOrder] = useState('newest')
  const [expandedCustomers, setExpandedCustomers] = useState({})
  const [expandedOrders, setExpandedOrders] = useState({})
  const [storeItems, setStoreItems] = useState([])

  const [bomForm, setBomForm] = useState({
    finished_good_id: '', version: '1.0',
    finished_good_name: '',
    line_items: [{ raw_material_id: '', raw_material_name: '', quantity_required: '', unit: 'kg', scrap_percentage: 0 }]
  })
  const [orderForm, setOrderForm] = useState({
    bom_id: '', planned_quantity: '', customer_id: ''
  })
  const [actualQty, setActualQty] = useState('')
  const [scrapQty, setScrapQty] = useState(0)

  const fetchAll = async () => {
    try {
      const [ordersRes, bomsRes, itemsRes, customersRes, storeRes] = await Promise.all([
        api.get('/production/orders'),
        api.get('/production/bom'),
        api.get('/master/items'),
        api.get('/master/customers'),
        api.get('/api/inventory/in-store')
      ])
      setOrders(ordersRes.data)
      setBoms(bomsRes.data)
      setItems(itemsRes.data)
      setCustomers(customersRes.data)
      setStoreItems(storeRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  // Group orders by customer name
  const groupedByCustomer = () => {
    const map = {}
    const sorted = [...orders].sort((a, b) =>
      sortOrder === 'newest'
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    )
    sorted.forEach(order => {
      const key = order.customer_name || 'No Customer'
      if (!map[key]) map[key] = []
      map[key].push(order)
    })
    return map
  }

  const toggleCustomer = (name) => {
    setExpandedCustomers(prev => ({ ...prev, [name]: prev[name] === false ? true : false }))
  }

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  const handleCreateBOM = async (e) => {
    e.preventDefault()
    try {
      await api.post('/production/bom', {
        finished_good_id: parseInt(bomForm.finished_good_id),
        version: bomForm.version,
        line_items: bomForm.line_items.map(li => ({
          raw_material_id: parseInt(li.raw_material_id),
          quantity_required: parseFloat(li.quantity_required),
          unit: li.unit,
          scrap_percentage: parseFloat(li.scrap_percentage),
        }))
      })
      setShowBOMForm(false)
      setBomForm({                        // ← add this
      finished_good_id: '',
      finished_good_name: '',
      version: '1.0',
      line_items: [{ raw_material_id: '', quantity_required: '', unit: 'kg', scrap_percentage: 0 }]
    })
      fetchAll()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    try {
      await api.post('/production/orders', {
        bom_id: parseInt(orderForm.bom_id),
        planned_quantity: parseInt(orderForm.planned_quantity),
        customer_id: orderForm.customer_id ? parseInt(orderForm.customer_id) : null
      })
      setShowOrderForm(false)
      setOrderForm({ bom_id: '', planned_quantity: '', customer_id: '' })
      fetchAll()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const handleComplete = async (orderId) => {
    try {
      await api.patch(`/production/orders/${orderId}/complete?actual_quantity=${actualQty}&scrap_quantity=${scrapQty}`)
      setCompleteModal(null)
      fetchAll()
      handleViewQR(orderId)
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const handleViewQR = async (orderId) => {
    try {
      const res = await api.get(`/production/orders/${orderId}/qr-codes`)
      setQrCodes(res.data)
      setQrModal(orderId)
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (otp) => {
    try {
      await api.delete(`/production/orders/${deleteTarget.id}?otp=${otp}`)
      setDeleteTarget(null)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting order')
    }
  }

  const rawMaterials = items.filter(i => i.item_type === 'raw_material')
  const finishedGoods = items.filter(i => i.item_type === 'finished_good')
  const getBOMName = (id) => boms.find(b => b.id === id)?.finished_good || '—'

  const totalCost = (groupOrders) =>
    groupOrders.reduce((sum, o) => sum + (parseFloat(o.production_cost) || 0), 0)

  const customerGroups = groupedByCustomer()

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production</h1>
          <p className="text-slate-500 text-sm mt-1">
            {orders.length} orders · {boms.length} BOMs
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-teal-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <button
            onClick={() => setShowBOMForm(!showBOMForm)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >+ New BOM</button>
          <button
            onClick={() => setShowOrderForm(!showOrderForm)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
          >+ New Order</button>
        </div>
      </div>

      {/* BOM Form */}
      {showBOMForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Create Bill of Materials</h2>
          <form onSubmit={handleCreateBOM} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Finished Good</label>
                <input
  list="finished-goods-list"
  placeholder="Type to search finished good..."
  value={bomForm.finished_good_name || ''}
  onChange={e => {
    const typed = e.target.value
    const match = finishedGoods.find(i => i.name.toLowerCase() === typed.toLowerCase())
    setBomForm({
      ...bomForm,
      finished_good_name: typed,
      finished_good_id: match ? match.id : ''
    })
  }}
  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
  required
/>
<datalist id="finished-goods-list">
  {finishedGoods.map(i => <option key={i.id} value={i.name} />)}
</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Version</label>
                <input
                  value={bomForm.version}
                  onChange={e => setBomForm({ ...bomForm, version: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Raw Materials Required</label>
              {bomForm.line_items.map((li, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                  <>
  <input
    list={`material-list-${i}`}
    placeholder="Type to search material..."
    value={li.raw_material_name || ''}
    onChange={e => {
      const typed = e.target.value
      const match = storeItems.find(m => m.name.toLowerCase() === typed.toLowerCase())
      const u = [...bomForm.line_items]
      u[i] = {
        ...u[i],
        raw_material_name: typed,
        raw_material_id: match ? match.item_id : ''
      }
      setBomForm({ ...bomForm, line_items: u })
    }}
    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
    required
  />
  <datalist id={`material-list-${i}`}>
    {storeItems.map(m => (
      <option key={m.item_id} value={m.name}>
        {m.part_code ? `${m.name} (${m.part_code})` : m.name}
      </option>
    ))}
  </datalist>
</>
                  <input
                    type="number" placeholder="Qty required" value={li.quantity_required}
                    onChange={e => { const u = [...bomForm.line_items]; u[i].quantity_required = e.target.value; setBomForm({ ...bomForm, line_items: u }) }}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required
                  />
                  <input
                    type="number" placeholder="Scrap %" value={li.scrap_percentage}
                    onChange={e => { const u = [...bomForm.line_items]; u[i].scrap_percentage = e.target.value; setBomForm({ ...bomForm, line_items: u }) }}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setBomForm({ ...bomForm, line_items: bomForm.line_items.filter((_, idx) => idx !== i) })}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >Remove</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setBomForm({ ...bomForm, line_items: [...bomForm.line_items, { raw_material_id: '', quantity_required: '', unit: 'kg', scrap_percentage: 0 }] })}
                className="text-sm text-teal-600 hover:text-teal-500"
              >+ Add material</button>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">Create BOM</button>
              <button type="button" onClick={() => setShowBOMForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Order Form */}
      {showOrderForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Create Production Order</h2>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Customer</label>
                <select
                  value={orderForm.customer_id}
                  onChange={e => setOrderForm({ ...orderForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">BOM</label>
                <select
                  value={orderForm.bom_id}
                  onChange={e => setOrderForm({ ...orderForm, bom_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                >
                  <option value="">Select BOM...</option>
                  {boms.map(b => <option key={b.id} value={b.id}>{b.finished_good} v{b.version}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Planned Quantity</label>
                <input
                  type="number" value={orderForm.planned_quantity}
                  onChange={e => setOrderForm({ ...orderForm, planned_quantity: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Create Order</button>
              <button type="button" onClick={() => setShowOrderForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Grouped by Customer ── */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-10 text-center text-slate-400">
          No production orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(customerGroups).map(([customerName, customerOrders]) => {
            const isExpanded = expandedCustomers[customerName] !== false
            const completedCount = customerOrders.filter(o => o.status === 'completed').length
            const totalProductCost = totalCost(customerOrders)
            const initial = customerName.trim()[0]?.toUpperCase() || '?'

            return (
              <div key={customerName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Customer Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleCustomer(customerName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {initial}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 text-sm">{customerName.toUpperCase()}</span>
                      <span className="ml-2 text-slate-400 text-xs">
                        {customerOrders.length} order{customerOrders.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-slate-700">
                      {totalProductCost > 0 ? `₹${Number(totalProductCost).toLocaleString('en-IN')}` : '—'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {completedCount}/{customerOrders.length} completed
                    </span>
                    <span className={`text-slate-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  </div>
                </div>

                {/* Orders Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-xs uppercase">
                          <th className="px-5 py-2 text-left font-semibold">Order No.</th>
                          <th className="px-5 py-2 text-left font-semibold">Product</th>
                          <th className="px-5 py-2 text-left font-semibold">Created</th>
                          <th className="px-5 py-2 text-right font-semibold">Planned Qty</th>
                          <th className="px-5 py-2 text-right font-semibold">Actual Qty</th>
                          <th className="px-5 py-2 text-right font-semibold">Cost</th>
                          <th className="px-5 py-2 text-center font-semibold">Status</th>
                          <th className="px-5 py-2 text-center font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {customerOrders.map(order => (
                          <>
                            <tr
                              key={order.id}
                              className={`hover:bg-slate-50 cursor-pointer transition-colors ${expandedOrders[order.id] ? 'bg-teal-50' : ''}`}
                              onClick={() => toggleOrder(order.id)}
                            >
                              <td className="px-5 py-3 font-medium text-slate-700">
                                <span className={`inline-block mr-2 text-slate-400 text-xs transition-transform duration-200 ${expandedOrders[order.id] ? 'rotate-90' : ''}`}>▶</span>
                                {order.order_number}
                              </td>
                              <td className="px-5 py-3 text-slate-600 font-medium">
                                {getBOMName(order.bom_id)}
                              </td>
                              <td className="px-5 py-3 text-slate-500 text-xs">
                                {order.created_at
                                  ? new Date(order.created_at).toLocaleDateString('en-GB', {
                                      day: '2-digit', month: '2-digit', year: '2-digit',
                                      hour: '2-digit', minute: '2-digit'
                                    })
                                  : '—'}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600">
                                {Number(order.planned_quantity).toLocaleString('en-IN')}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600">
                                {order.actual_quantity ? Number(order.actual_quantity).toLocaleString('en-IN') : '—'}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600">
                                {order.production_cost ? `₹${Number(order.production_cost).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <StatusBadge status={order.status} />
                              </td>
                              <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex gap-2 justify-center">
                                  {order.status === 'planned' && (
                                    <button
                                      onClick={() => { setCompleteModal(order.id); setActualQty(order.planned_quantity) }}
                                      className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium"
                                    >Complete</button>
                                  )}
                                  {order.status === 'completed' && (
                                    <button
                                      onClick={() => handleViewQR(order.id)}
                                      className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium"
                                    >View QR</button>
                                  )}
                                  <button
                                    onClick={() => setDeleteTarget({ id: order.id, name: order.order_number })}
                                    className="px-3 py-1 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium"
                                  >Delete</button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable detail row */}
                            {expandedOrders[order.id] && (
                              <tr key={`${order.id}-detail`}>
                                <td colSpan={8} className="bg-teal-50 border-b border-teal-100 px-6 py-3">
                                  <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-2">
                                    Order Detail — {order.order_number}
                                  </p>
                                  <div className="flex flex-wrap gap-6 text-xs text-slate-600">
                                    <span>👤 <strong>Customer:</strong> {customerName}</span>
                                    <span>📦 <strong>Product:</strong> {getBOMName(order.bom_id)}</span>
                                    <span>🔢 <strong>Planned:</strong> {order.planned_quantity}</span>
                                    {order.actual_quantity && <span>✅ <strong>Actual:</strong> {order.actual_quantity}</span>}
                                    {order.scrap_quantity > 0 && <span>🗑 <strong>Scrap:</strong> {order.scrap_quantity}</span>}
                                    {order.production_cost && <span>💰 <strong>Cost:</strong> ₹{Number(order.production_cost).toLocaleString('en-IN')}</span>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-700 mb-4">Complete Production Order</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Actual Quantity Produced</label>
                <input
                  type="number" value={actualQty} onChange={e => setActualQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Scrap Quantity</label>
                <input
                  type="number" value={scrapQty} onChange={e => setScrapQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleComplete(completeModal)}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
                >Complete & Generate QR</button>
                <button
                  onClick={() => setCompleteModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">
                QR Codes — Order #{qrModal} ({qrCodes.length} parts)
              </h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">🖨️ Print All</button>
                <button onClick={() => { setQrModal(null); setQrCodes([]) }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">Close</button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4">
              {qrCodes.map((part, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 text-center">
                  <img src={`data:image/png;base64,${part.qr_code_image}`} alt={part.serial_number} className="w-full mb-2" />
                  <p className="text-xs font-mono text-slate-600 break-all">{part.serial_number}</p>
                  <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">{part.status}</span>
                </div>
              ))}
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