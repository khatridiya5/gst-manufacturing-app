import { useEffect, useState } from 'react'
import api from '../../api/client'

const emptyForm = {
  name: '', gstin: '', state: '', state_code: '', phone: '', email: '',
  bank_name: '', account_number: '', ifsc_code: '', account_holder_name: ''
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({}) // { customerId: { total, paid, balance } }
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedBank, setExpandedBank] = useState(null) // customer id whose bank info is shown
  const [form, setForm] = useState(emptyForm)

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/master/customers')
      setCustomers(res.data)
      // fetch balance for each customer in parallel
      const entries = await Promise.all(
        res.data.map(async (c) => {
          try {
            const b = await api.get(`/master/customers/${c.id}/balance`)
            return [c.id, b.data]
          } catch {
            return [c.id, { total: '0', paid: '0', balance: '0' }]
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

  useEffect(() => { fetchCustomers() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/master/customers', form)
      setShowForm(false)
      setForm(emptyForm)
      fetchCustomers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleDelete = async (customerId, customerName) => {
    if (!confirm(`Delete "${customerName}"? This cannot be undone.`)) return
    try {
      await api.delete(`/master/customers/${customerId}`)
      fetchCustomers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting customer')
    }
  }

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  const basicFields = [
    { label: 'Company Name', key: 'name', placeholder: 'Tata Motors Ltd', required: true },
    { label: 'GSTIN', key: 'gstin', placeholder: '27AAACT2727Q1ZV' },
    { label: 'State', key: 'state', placeholder: 'Maharashtra' },
    { label: 'State Code', key: 'state_code', placeholder: '27' },
    { label: 'Phone', key: 'phone', placeholder: '9876543210' },
    { label: 'Email', key: 'email', placeholder: 'buyer@tata.com' },
  ]

  const bankFields = [
    { label: 'Account Holder Name', key: 'account_holder_name', placeholder: 'Tata Motors Ltd' },
    { label: 'Bank Name', key: 'bank_name', placeholder: 'ICICI Bank' },
    { label: 'Account Number', key: 'account_number', placeholder: '9876543210123' },
    { label: 'IFSC Code', key: 'ifsc_code', placeholder: 'ICIC0001234' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
        >
          + Add Customer
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Add New Customer</h2>
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
              <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Add Customer</button>
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
              <th className="px-5 py-3 text-right">Balance to Receive</th>
              <th className="px-5 py-3 text-center">Bank</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {customers.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No customers yet.</td></tr>
            )}
            {customers.map(c => {
              const bal = balances[c.id]
              const balNum = bal ? Number(bal.balance) : 0
              const hasBankDetails = c.bank_name || c.account_number || c.ifsc_code
              return (
                <>
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{c.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{c.gstin || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{c.state || '—'} {c.state_code ? `(${c.state_code})` : ''}</td>
                    <td className="px-5 py-3 text-slate-500">{c.phone || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {bal ? (
                        <div>
                          <span className={`font-semibold ${balNum > 0 ? 'text-green-600' : 'text-slate-400'}`}>
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
                          onClick={() => setExpandedBank(expandedBank === c.id ? null : c.id)}
                          className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                        >
                          {expandedBank === c.id ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="px-3 py-1 border border-red-300 hover:bg-red-50 text-red-500 rounded-lg text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>

                  {/* Bank details expandable row */}
                  {expandedBank === c.id && (
                    <tr key={`bank-${c.id}`} className="bg-blue-50">
                      <td colSpan={8} className="px-5 py-3">
                        <div className="flex gap-8 text-sm">
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Account Holder</span>
                            <p className="font-medium text-slate-700 mt-0.5">{c.account_holder_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Bank</span>
                            <p className="font-medium text-slate-700 mt-0.5">{c.bank_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Account No.</span>
                            <p className="font-medium text-slate-700 mt-0.5 font-mono">{c.account_number || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">IFSC</span>
                            <p className="font-medium text-slate-700 mt-0.5 font-mono">{c.ifsc_code || '—'}</p>
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