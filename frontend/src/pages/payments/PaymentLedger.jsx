import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

export default function PaymentLedger() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
          <h1 className="text-2xl font-bold text-gray-800">Payment Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of payables and receivables</p>
        </div>
        <button
          onClick={fetchSummary}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {summary && (
        <>
          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Payable */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Total Payable
                </span>
                <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                  You Owe
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">
                ₹{Number(summary.total_payable).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {summary.payable_count} unpaid supplier bills
              </p>
              <div className="mt-4 h-1 bg-red-100 rounded-full">
                <div
                  className="h-1 bg-red-400 rounded-full"
                  style={{ width: net === 0 ? '50%' : `${Math.min(100, (Number(summary.total_payable) / (Number(summary.total_payable) + Number(summary.total_receivable))) * 100)}%` }}
                />
              </div>
            </div>

            {/* Receivable */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Total Receivable
                </span>
                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  Incoming
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">
                ₹{Number(summary.total_receivable).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {summary.receivable_count} pending customer invoices
              </p>
              <div className="mt-4 h-1 bg-green-100 rounded-full">
                <div
                  className="h-1 bg-green-400 rounded-full"
                  style={{ width: net === 0 ? '50%' : `${Math.min(100, (Number(summary.total_receivable) / (Number(summary.total_payable) + Number(summary.total_receivable))) * 100)}%` }}
                />
              </div>
            </div>

            {/* Net Position */}
            <div className={`bg-white border rounded-xl p-5 shadow-sm ${net >= 0 ? 'border-teal-200' : 'border-orange-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Net Position
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  net >= 0
                    ? 'bg-teal-50 text-teal-600'
                    : 'bg-orange-50 text-orange-500'
                }`}>
                  {net >= 0 ? 'Surplus' : 'Deficit'}
                </span>
              </div>
              <p className={`text-3xl font-bold ${net >= 0 ? 'text-teal-600' : 'text-orange-500'}`}>
                ₹{Math.abs(net).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {net >= 0 ? 'You will receive more than you pay' : 'You owe more than you receive'}
              </p>
              <div className="mt-4 h-1 bg-gray-100 rounded-full">
                <div className={`h-1 rounded-full ${net >= 0 ? 'bg-teal-400' : 'bg-orange-400'}`} style={{ width: '60%' }} />
              </div>
            </div>

          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <button
              onClick={() => navigate('/payments/payables')}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left hover:border-red-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-red-500 transition">
                    View All Payables
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supplier bills pending payment
                  </p>
                </div>
                <span className="text-2xl">🔴</span>
              </div>
              <p className="text-xs text-red-400 mt-3 font-medium">
                {summary.payable_count} bills → →
              </p>
            </button>

            <button
              onClick={() => navigate('/payments/receivables')}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left hover:border-green-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-green-600 transition">
                    View All Receivables
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Customer invoices pending collection
                  </p>
                </div>
                <span className="text-2xl">🟢</span>
              </div>
              <p className="text-xs text-green-500 mt-3 font-medium">
                {summary.receivable_count} invoices → →
              </p>
            </button>

          </div>
        </>
      )}

      {/* Empty state */}
      {!summary && !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No payment data found</p>
          <p className="text-sm mt-1">Add purchase orders or sales invoices to get started</p>
        </div>
      )}
    </div>
  )
}