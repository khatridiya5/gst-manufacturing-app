import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function Items() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', item_type: 'raw_material', hsn_code: '', unit: 'kg', tax_rate: '', opening_stock: 0 })

  const fetchItems = async () => {
    try {
      const res = await api.get('/master/items')
      setItems(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/master/items', { ...form, tax_rate: parseFloat(form.tax_rate), opening_stock: parseFloat(form.opening_stock) })
      setShowForm(false)
      setForm({ name: '', code: '', item_type: 'raw_material', hsn_code: '', unit: 'kg', tax_rate: '', opening_stock: 0 })
      fetchItems()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const typeColors = { raw_material: 'bg-slate-100 text-slate-600', finished_good: 'bg-teal-50 text-teal-700', scrap: 'bg-red-50 text-red-600' }

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Items</h1>
          <p className="text-slate-500 text-sm mt-1">{items.length} items</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">+ Add Item</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Add New Item</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Steel Rod 10mm" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Code</label>
                <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="RM001" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
                <select value={form.item_type} onChange={e => setForm({...form, item_type: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
                  <option value="raw_material">Raw Material</option>
                  <option value="finished_good">Finished Good</option>
                  <option value="scrap">Scrap</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">HSN Code</label>
                <input value={form.hsn_code} onChange={e => setForm({...form, hsn_code: e.target.value})} placeholder="72142000" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
                  {['kg', 'pcs', 'ltr', 'mtr', 'box', 'ton'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tax Rate (%)</label>
                <select value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" required>
                  <option value="">Select...</option>
                  {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Opening Stock</label>
                <input type="number" value={form.opening_stock} onChange={e => setForm({...form, opening_stock: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Add Item</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Code</th>
              <th className="px-5 py-3 text-left">HSN</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-center">Unit</th>
              <th className="px-5 py-3 text-center">Tax</th>
              <th className="px-5 py-3 text-right">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No items yet.</td></tr>}
            {items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-700">{item.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.code || '—'}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.hsn_code}</td>
                <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[item.item_type]}`}>{item.item_type?.replace('_', ' ')}</span></td>
                <td className="px-5 py-3 text-center text-slate-500">{item.unit}</td>
                <td className="px-5 py-3 text-center text-slate-500">{item.tax_rate}%</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-700">{Number(item.current_stock).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}