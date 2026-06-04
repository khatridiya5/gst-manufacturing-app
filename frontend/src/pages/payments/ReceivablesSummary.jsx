import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function ReceivablesSummary() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReceivables() }, [])

  const fetchReceivables = async () => {
    setLoading(true)
    try {
      const res = await api.get('/payments/receivables')
      setData(res.data.items)
      setTotal(res.data.total_receivable)
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

  if (loading) return <div className="p-6 text-gray-500">Loading receivables...</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🟢 Receivables</h1>
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3 text-right">
          <p className="text-xs text-green-400">Total To Receive</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{Number(total).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Customer', 'Invoice No', 'Invoice Date', 'Due Date',
                'Total', 'Paid', 'Balance Due', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">
                  No pending receivables
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr key={i} className="border-t hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium">{item.customer}</td>
                  <td className="px-4 py-3 text-gray-500">{item.invoice_no}</td>
                  <td className="px-4 py-3 text-gray-500">{item.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-500">{item.due_date}</td>
                  <td className="px-4 py-3">₹{Number(item.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">
                    ₹{Number(item.paid).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-700">
                    ₹{Number(item.balance).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}