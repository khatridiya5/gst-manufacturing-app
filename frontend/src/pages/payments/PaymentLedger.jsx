import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function PaymentLedger() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSummary() }, [])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await api.get('/payments/summary')
      setSummary(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading ledger...</div>

  const net = summary ? Number(summary.net_position) : 0

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📒 Payment Ledger</h1>

      {summary && (
        <>
          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm text-red-400 mb-1">Total Payable</p>
              <p className="text-3xl font-bold text-red-600">
                ₹{Number(summary.total_payable).toLocaleString()}
              </p>
              <p className="text-xs text-red-400 mt-1">
                {summary.payable_count} unpaid supplier bills
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-400 mb-1">Total Receivable</p>
              <p className="text-3xl font-bold text-green-600">
                ₹{Number(summary.total_receivable).toLocaleString()}
              </p>
              <p className="text-xs text-green-400 mt-1">
                {summary.receivable_count} pending customer invoices
              </p>
            </div>

            <div className={`rounded-xl p-5 border ${
              net >= 0
                ? 'bg-blue-50 border-blue-200'
                : 'bg-orange-50 border-orange-200'
            }`}>
              <p className={`text-sm mb-1 ${net >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                Net Position
              </p>
              <p className={`text-3xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                ₹{Math.abs(net).toLocaleString()}
              </p>
              <p className={`text-xs mt-1 ${net >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                {net >= 0 ? '✅ You will receive more than you pay' : '⚠️ You owe more than you receive'}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex gap-3">
            <a href="/payments/payables"
              className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition">
              View All Payables →
            </a>
            <a href="/payments/receivables"
              className="px-5 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition">
              View All Receivables →
            </a>
          </div>
        </>
      )}
    </div>
  )
}