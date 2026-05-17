import { useEffect, useState } from 'react'
import api from '../../api/client'

const StatusBadge = ({ status }) => {
  const colors = { planned: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-600' }
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function ProductionOrders() {
  const [orders, setOrders] = useState([])
  const [boms, setBoms] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBOMForm, setShowBOMForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [completeModal, setCompleteModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [qrCodes, setQrCodes] = useState([])

  const [bomForm, setBomForm] = useState({ finished_good_id: '', version: '1.0', line_items: [{ raw_material_id: '', quantity_required: '', unit: 'kg', scrap_percentage: 0 }] })
  const [orderForm, setOrderForm] = useState({ bom_id: '', planned_quantity: '' })
  const [actualQty, setActualQty] = useState('')
  const [scrapQty, setScrapQty] = useState(0)

  const fetchAll = async () => {
    try {
      const [ordersRes, bomsRes, itemsRes] = await Promise.all([
        api.get('/production/orders'),
        api.get('/production/bom'),
        api.get('/master/items'),
      ])
      setOrders(ordersRes.data)
      setBoms(bomsRes.data)
      setItems(itemsRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

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
      fetchAll()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    try {
      await api.post('/production/orders', { bom_id: parseInt(orderForm.bom_id), planned_quantity: parseInt(orderForm.planned_quantity) })
      setShowOrderForm(false)
      setOrderForm({ bom_id: '', planned_quantity: '' })
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

  const handleDelete = async (orderId, orderNumber) => {
    if (!confirm(`Delete ${orderNumber}? This cannot be undone.`)) return
    try {
      await api.delete(`/production/orders/${orderId}`)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting order')
    }
  }

  const rawMaterials = items.filter(i => i.item_type === 'raw_material')
  const finishedGoods = items.filter(i => i.item_type === 'finished_good')
  const getBOMName = (id) => boms.find(b => b.id === id)?.finished_good || '—'

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} orders · {boms.length} BOMs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBOMForm(!showBOMForm)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">+ New BOM</button>
          <button onClick={() => setShowOrderForm(!showOrderForm)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">+ New Order</button>
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
                <select value={bomForm.finished_good_id} onChange={e => setBomForm({...bomForm, finished_good_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required>
                  <option value="">Select finished good...</option>
                  {finishedGoods.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Version</label>
                <input value={bomForm.version} onChange={e => setBomForm({...bomForm, version: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Raw Materials Required</label>
              {bomForm.line_items.map((li, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                  <select value={li.raw_material_id} onChange={e => { const u=[...bomForm.line_items]; u[i].raw_material_id=e.target.value; setBomForm({...bomForm, line_items:u}) }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required>
                    <option value="">Select material...</option>
                    {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty required" value={li.quantity_required} onChange={e => { const u=[...bomForm.line_items]; u[i].quantity_required=e.target.value; setBomForm({...bomForm, line_items:u}) }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required />
                  <input type="number" placeholder="Scrap %" value={li.scrap_percentage} onChange={e => { const u=[...bomForm.line_items]; u[i].scrap_percentage=e.target.value; setBomForm({...bomForm, line_items:u}) }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                  <button type="button" onClick={() => setBomForm({...bomForm, line_items: bomForm.line_items.filter((_,idx)=>idx!==i)})} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setBomForm({...bomForm, line_items: [...bomForm.line_items, { raw_material_id:'', quantity_required:'', unit:'kg', scrap_percentage:0 }]})} className="text-sm text-teal-600 hover:text-teal-500">+ Add material</button>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">BOM</label>
                <select value={orderForm.bom_id} onChange={e => setOrderForm({...orderForm, bom_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required>
                  <option value="">Select BOM...</option>
                  {boms.map(b => <option key={b.id} value={b.id}>{b.finished_good} v{b.version}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Planned Quantity</label>
                <input type="number" value={orderForm.planned_quantity} onChange={e => setOrderForm({...orderForm, planned_quantity: e.target.value})} placeholder="e.g. 50" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Create Order</button>
              <button type="button" onClick={() => setShowOrderForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
              <th className="px-5 py-3 text-left">Order No.</th>
              <th className="px-5 py-3 text-left">Product</th>
              <th className="px-5 py-3 text-right">Planned Qty</th>
              <th className="px-5 py-3 text-right">Actual Qty</th>
              <th className="px-5 py-3 text-right">Cost</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No production orders yet.</td></tr>}
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-700">{order.order_number}</td>
                <td className="px-5 py-3 text-slate-600">{getBOMName(order.bom_id)}</td>
                <td className="px-5 py-3 text-right text-slate-600">{Number(order.planned_quantity).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right text-slate-600">{order.actual_quantity ? Number(order.actual_quantity).toLocaleString('en-IN') : '—'}</td>
                <td className="px-5 py-3 text-right text-slate-600">{order.production_cost ? `₹${Number(order.production_cost).toLocaleString('en-IN')}` : '—'}</td>
                <td className="px-5 py-3 text-center"><StatusBadge status={order.status} /></td>
                <td className="px-5 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    {order.status === 'planned' && (
                      <button onClick={() => { setCompleteModal(order.id); setActualQty(order.planned_quantity) }} className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium">Complete</button>
                    )}
                    {order.status === 'completed' && (
                      <button onClick={() => handleViewQR(order.id)} className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium">View QR</button>
                    )}
                    <button
                      onClick={() => handleDelete(order.id, order.order_number)}
                      className="px-3 py-1 border border-red-300 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-700 mb-4">Complete Production Order</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Actual Quantity Produced</label>
                <input type="number" value={actualQty} onChange={e => setActualQty(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Scrap Quantity</label>
                <input type="number" value={scrapQty} onChange={e => setScrapQty(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleComplete(completeModal)} className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Complete & Generate QR</button>
                <button onClick={() => setCompleteModal(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">Cancel</button>
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
              <h2 className="font-semibold text-slate-700">QR Codes — Production Order #{qrModal} ({qrCodes.length} parts)</h2>
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
    </div>
  )
}// updated
