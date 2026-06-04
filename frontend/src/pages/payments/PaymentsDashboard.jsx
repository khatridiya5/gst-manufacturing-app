import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function PaymentsDashboard() {
  const [summary, setSummary] = useState(null)
  const [payables, setPayables] = useState([])
  const [receivables, setReceivables] = useState([])
  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, p, r] = await Promise.all([
        api.get('/payments/summary'),
        api.get('/payments/payables'),
        api.get('/payments/receivables'),
      ])
      setSummary(s.data)
      setPayables(p.data.items)
      setReceivables(r.data.items)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const statusColor = (status) => {
    if (status === 'paid') return 'bg-green-100 text-green-700'
    if (status === 'overdue') return 'bg-red-100 text-red-700'
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (loading) return <div className="p-6">Loading payments...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">💰 Payments</h1>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-500">You Need to Pay</p>
            <p className="text-2xl font-bold text-red-600">
              ₹{Number(summary.total_payable).toLocaleString()}
            </p>
            <p className="text-xs text-red-400">{summary.payable_count} pending bills</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-500">You Will Receive</p>
            <p className="text-2xl font-bold text-green-600">
              ₹{Number(summary.total_receivable).toLocaleString()}
            </p>
            <p className="text-xs text-green-400">{summary.receivable_count} pending invoices</p>
          </div>

          <div className={`border rounded-xl p-4 ${
            Number(summary.net_position) >= 0 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <p className="text-sm text-blue-500">Net Position</p>
            <p className={`text-2xl font-bold ${
              Number(summary.net_position) >= 0 ? 'text-blue-600' : 'text-orange-600'
            }`}>
              ₹{Number(summary.net_position).toLocaleString()}
            </p>
            <p className="text-xs text-blue-400">
              {Number(summary.net_position) >= 0 ? '✅ Positive cashflow' : '⚠️ More going out'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {['summary', 'payables', 'receivables'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg capitalize font-medium ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Payables Table */}
      {activeTab === 'payables' && (
        <div>
          <h2 className="text-lg font-semibold mb-3">🔴 Payables — Raw Material Bills</h2>
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {['Vendor','Invoice No','Invoice Date','Due Date','Total','Paid','Balance','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payables.map((p, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.vendor}</td>
                  <td className="px-4 py-2">{p.invoice_no}</td>
                  <td className="px-4 py-2">{p.invoice_date}</td>
                  <td className="px-4 py-2">{p.due_date}</td>
                  <td className="px-4 py-2">₹{Number(p.total).toLocaleString()}</td>
                  <td className="px-4 py-2 text-green-600">₹{Number(p.paid).toLocaleString()}</td>
                  <td className="px-4 py-2 font-bold text-red-600">₹{Number(p.balance).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Receivables Table */}
      {activeTab === 'receivables' && (
        <div>
          <h2 className="text-lg font-semibold mb-3">🟢 Receivables — Customer Invoices</h2>
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {['Customer','Invoice No','Invoice Date','Due Date','Total','Paid','Balance','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receivables.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.customer}</td>
                  <td className="px-4 py-2">{r.invoice_no}</td>
                  <td className="px-4 py-2">{r.invoice_date}</td>
                  <td className="px-4 py-2">{r.due_date}</td>
                  <td className="px-4 py-2">₹{Number(r.total).toLocaleString()}</td>
                  <td className="px-4 py-2 text-green-600">₹{Number(r.paid).toLocaleString()}</td>
                  <td className="px-4 py-2 font-bold text-green-600">₹{Number(r.balance).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}