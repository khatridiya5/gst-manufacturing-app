import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function PayablesSummary() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchPayables() }, [])

  const fetchPayables = async () => {
    setLoading(true)
    try {
      const res = await api.get('/payments/payables')
      setData(res.data.items)
      setTotal(res.data.total_payable)
      setCount(res.data.items?.length || 0)
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

  const filtered = filter === 'all' ? data : data.filter(d => d.status === filter)

  const overdue  = data.filter(d => d.status === 'overdue').length
  const partial  = data.filter(d => d.status === 'partial').length
  const paid     = data.filter(d => d.status === 'paid').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payables</h1>
          <p className="text-sm text-gray-500 mt-1">{count} supplier bills</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter dropdown */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
          <button
            onClick={fetchPayables}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Owed</span>
            <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">You Owe</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">₹{Number(total).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">{count} total bills</p>
          <div className="mt-4 h-1 bg-red-100 rounded-full">
            <div className="h-1 bg-red-400 rounded-full" style={{ width: '60%' }} />
          </div>
        </div>

        <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Overdue</p>
          <p className="text-2xl font-bold text-red-500">{overdue}</p>
          <p className="text-xs text-gray-400 mt-2">bills past due date</p>
          <div className="mt-4 h-1 bg-red-100 rounded-full">
            <div className="h-1 bg-red-400 rounded-full" style={{ width: count ? `${(overdue/count)*100}%` : '0%' }} />
          </div>
        </div>

        <div className="bg-white border border-yellow-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Partial</p>
          <p className="text-2xl font-bold text-yellow-500">{partial}</p>
          <p className="text-xs text-gray-400 mt-2">partially paid</p>
          <div className="mt-4 h-1 bg-yellow-100 rounded-full">
            <div className="h-1 bg-yellow-400 rounded-full" style={{ width: count ? `${(partial/count)*100}%` : '0%' }} />
          </div>
        </div>

        <div className="bg-white border border-green-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Paid</p>
          <p className="text-2xl font-bold text-green-600">{paid}</p>
          <p className="text-xs text-gray-400 mt-2">fully settled</p>
          <div className="mt-4 h-1 bg-green-100 rounded-full">
            <div className="h-1 bg-green-400 rounded-full" style={{ width: count ? `${(paid/count)*100}%` : '0%' }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Vendor', 'Invoice No', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Balance Due', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No pending payables 🎉
                </td>
              </tr>
            ) : filtered.map((item, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">{item.vendor}</td>
                <td className="px-4 py-3 text-gray-600">{item.invoice_no}</td>
                <td className="px-4 py-3 text-gray-600">{item.invoice_date}</td>
                <td className="px-4 py-3 text-gray-600">{item.due_date}</td>
                <td className="px-4 py-3 text-gray-800">₹{Number(item.total).toLocaleString()}</td>
                <td className="px-4 py-3 text-green-600">₹{Number(item.paid).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-red-600">₹{Number(item.balance).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}