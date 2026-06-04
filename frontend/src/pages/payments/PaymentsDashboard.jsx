import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function PaymentsDashboard() {
  const [summary, setSummary] = useState(null)
  const [payables, setPayables] = useState([])
  const [receivables, setReceivables] = useState([])
  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

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
    if (status === 'paid')    return 'bg-green-100 text-green-700'
    if (status === 'overdue') return 'bg-red-100 text-red-700'
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
    </div>
  )

  const net = summary ? Number(summary.net_position) : 0

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'summary'     && 'Overview of payables and receivables'}
            {activeTab === 'payables'    && `${payables.length} supplier bills`}
            {activeTab === 'receivables' && `${receivables.length} customer invoices`}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary Cards — always visible */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Payable</span>
              <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">You Owe</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              ₹{Number(summary.total_payable).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">{summary.payable_count} pending bills</p>
            <div className="mt-4 h-1 bg-red-100 rounded-full">
              <div className="h-1 bg-red-400 rounded-full" style={{ width: '60%' }} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Receivable</span>
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Incoming</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">
              ₹{Number(summary.total_receivable).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">{summary.receivable_count} pending invoices</p>
            <div className="mt-4 h-1 bg-green-100 rounded-full">
              <div className="h-1 bg-green-400 rounded-full" style={{ width: '75%' }} />
            </div>
          </div>

          <div className={`bg-white border rounded-xl p-5 shadow-sm ${net >= 0 ? 'border-teal-200' : 'border-orange-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Net Position</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${net >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-orange-50 text-orange-500'}`}>
                {net >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <p className={`text-3xl font-bold ${net >= 0 ? 'text-teal-600' : 'text-orange-500'}`}>
              ₹{Math.abs(net).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {net >= 0 ? 'You receive more than you pay' : 'You owe more than you receive'}
            </p>
            <div className="mt-4 h-1 bg-gray-100 rounded-full">
              <div className={`h-1 rounded-full ${net >= 0 ? 'bg-teal-400' : 'bg-orange-400'}`} style={{ width: '50%' }} />
            </div>
          </div>

        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {['summary', 'payables', 'receivables'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTab('payables')}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left hover:border-red-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 group-hover:text-red-500 transition">View All Payables</p>
                <p className="text-xs text-gray-400 mt-1">Supplier bills pending payment</p>
              </div>
              <span className="text-2xl">🔴</span>
            </div>
            <p className="text-xs text-red-400 mt-3 font-medium">{summary?.payable_count} bills →</p>
          </button>

          <button
            onClick={() => setActiveTab('receivables')}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left hover:border-green-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 group-hover:text-green-600 transition">View All Receivables</p>
                <p className="text-xs text-gray-400 mt-1">Customer invoices pending collection</p>
              </div>
              <span className="text-2xl">🟢</span>
            </div>
            <p className="text-xs text-green-500 mt-3 font-medium">{summary?.receivable_count} invoices →</p>
          </button>
        </div>
      )}

      {/* Payables Table */}
      {activeTab === 'payables' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Vendor', 'Invoice No', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No payables found</td>
                </tr>
              ) : payables.map((p, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.vendor}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_no}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-600">{p.due_date}</td>
                  <td className="px-4 py-3 text-gray-800">₹{Number(p.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">₹{Number(p.paid).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">₹{Number(p.balance).toLocaleString()}</td>
                  <td className="px-4 py-3">
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Customer', 'Invoice No', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No receivables found</td>
                </tr>
              ) : receivables.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.customer}</td>
                  <td className="px-4 py-3 text-gray-600">{r.invoice_no}</td>
                  <td className="px-4 py-3 text-gray-600">{r.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-600">{r.due_date}</td>
                  <td className="px-4 py-3 text-gray-800">₹{Number(r.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">₹{Number(r.paid).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">₹{Number(r.balance).toLocaleString()}</td>
                  <td className="px-4 py-3">
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