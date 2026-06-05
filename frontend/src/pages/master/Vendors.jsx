import { useEffect, useState } from 'react'
import api from '../../api/client'

const emptyForm = {
  name: '', gstin: '', state: '', state_code: '', phone: '', email: '',
  bank_name: '', account_number: '', ifsc_code: '', account_holder_name: ''
}

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [balances, setBalances] = useState({}) // { vendorId: { total, paid, balance } }
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedBank, setExpandedBank] = useState(null) // vendor id whose bank info is shown
  const [form, setForm] = useState(emptyForm)

  const fetchVendors = async () => {
    try {
      const res = await api.get('/master/vendors')
      setVendors(res.data)
      // fetch balance for each vendor in parallel
      const entries = await Promise.all(
        res.data.map(async (v) => {
          try {
            const b = await api.get(`/master/vendors/${v.id}/balance`)
            return [v.id, b.data]
          } catch {
            return [v.id, { total: '0', paid: '0', balance: '0' }]
          }
        })
      )
      setBalances(Object.fromEntries(entries))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVendors() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/master/vendors', form)
      setShowForm(false)
      setForm(emptyForm)
      fetchVendors()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleDelete = async (vendorId, vendorName) => {
    if (!confirm(`Delete "${vendorName}"? This cannot be undone.`)) return
    try {
      await api.delete(`/master/vendors/${vendorId}`)
      fetchVendors()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting vendor')
    }
  }

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  const basicFields = [
    { label: 'Company Name', key: 'name', placeholder: 'Steel Suppliers Pvt Ltd', required: true },
    { label: 'GSTIN', key: 'gstin', placeholder: '27AAAAA0000A1Z5' },
    { label: 'State', key: 'state', placeholder: 'Maharashtra' },
    { label: 'State Code', key: 'state_code', placeholder: '27' },
    { label: 'Phone', key: 'phone', placeholder: '9876543210' },
    { label: 'Email', key: 'email', placeholder: 'vendor@email.com' },
  ]

  const bankFields = [
    { label: 'Account Holder Name', key: 'account_holder_name', placeholder: 'Steel Suppliers Pvt Ltd' },
    { label: 'Bank Name', key: 'bank_name', placeholder: 'HDFC Bank' },
    { label: 'Account Number', key: 'account_number', placeholder: '1234567890123' },
    { label: 'IFSC Code', key: 'ifsc_code', placeholder: 'HDFC0001234' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
          <p className="text-slate-500 text-sm mt-1">{vendors.length} vendors</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
        >
          + Add Vendor
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Add New Vendor</h2>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-4">
              {basicFields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
                  <input
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    required={f.required}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              ))}
            </div>

            {/* Bank Details */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-4 h-px bg-slate-300 inline-block"></span>
                Bank Details (Optional)
                <span className="flex-1 h-px bg-slate-300 inline-block"></span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                {bankFields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
                    <input
                      value={form[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Add Vendor</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">GSTIN</th>
              <th className="px-5 py-3 text-left">State</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-right">Balance Due</th>
              <th className="px-5 py-3 text-center">Bank</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {vendors.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No vendors yet.</td></tr>
            )}
            {vendors.map(v => {
              const bal = balances[v.id]
              const balNum = bal ? Number(bal.balance) : 0
              const hasBankDetails = v.bank_name || v.account_number || v.ifsc_code
              return (
                <>
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{v.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{v.gstin || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{v.state || '—'} {v.state_code ? `(${v.state_code})` : ''}</td>
                    <td className="px-5 py-3 text-slate-500">{v.phone || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {bal ? (
                        <div>
                          <span className={`font-semibold ${balNum > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{balNum.toLocaleString()}
                          </span>
                          {balNum > 0 && (
                            <p className="text-xs text-slate-400">of ₹{Number(bal.total).toLocaleString()}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {hasBankDetails ? (
                        <button
                          onClick={() => setExpandedBank(expandedBank === v.id ? null : v.id)}
                          className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                        >
                          {expandedBank === v.id ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${v.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleDelete(v.id, v.name)}
                        className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>

                  {/* Bank details expandable row */}
                  {expandedBank === v.id && (
                    <tr key={`bank-${v.id}`} className="bg-blue-50">
                      <td colSpan={8} className="px-5 py-3">
                        <div className="flex gap-8 text-sm">
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Account Holder</span>
                            <p className="font-medium text-slate-700 mt-0.5">{v.account_holder_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Bank</span>
                            <p className="font-medium text-slate-700 mt-0.5">{v.bank_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Account No.</span>
                            <p className="font-medium text-slate-700 mt-0.5 font-mono">{v.account_number || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">IFSC</span>
                            <p className="font-medium text-slate-700 mt-0.5 font-mono">{v.ifsc_code || '—'}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}