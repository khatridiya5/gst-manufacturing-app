import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', gstin: '', state: '', state_code: '', phone: '', email: '' })

  const fetchVendors = async () => {
    try {
      const res = await api.get('/master/vendors')
      setVendors(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchVendors() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/master/vendors', form)
      setShowForm(false)
      setForm({ name: '', gstin: '', state: '', state_code: '', phone: '', email: '' })
      fetchVendors()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
          <p className="text-slate-500 text-sm mt-1">{vendors.length} vendors</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">+ Add Vendor</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Add New Vendor</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Company Name', key: 'name', placeholder: 'Steel Suppliers Pvt Ltd', required: true },
                { label: 'GSTIN', key: 'gstin', placeholder: '27AAAAA0000A1Z5' },
                { label: 'State', key: 'state', placeholder: 'Maharashtra' },
                { label: 'State Code', key: 'state_code', placeholder: '27' },
                { label: 'Phone', key: 'phone', placeholder: '9876543210' },
                { label: 'Email', key: 'email', placeholder: 'vendor@email.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder} required={f.required} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Add Vendor</button>
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
              <th className="px-5 py-3 text-left">GSTIN</th>
              <th className="px-5 py-3 text-left">State</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {vendors.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No vendors yet.</td></tr>}
            {vendors.map(v => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-700">{v.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{v.gstin || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{v.state || '—'} {v.state_code ? `(${v.state_code})` : ''}</td>
                <td className="px-5 py-3 text-slate-500">{v.phone || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${v.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{v.is_active ? 'Active' : 'Inactive'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}