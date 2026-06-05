import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function PayablesSummary() {
  const [vendors, setVendors] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { fetchPayables() }, [])

  const fetchPayables = async () => {
    setLoading(true)
    try {
      const res = await api.get('/payments/payables')
      setVendors(res.data.items)
      setTotal(res.data.total_payable)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleVendor = (vendorId) => {
    setExpanded(prev => ({ ...prev, [vendorId]: !prev[vendorId] }))
  }

  const statusColor = (status) => {
    if (status === 'paid')    return 'bg-green-100 text-green-700'
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700'
    if (status === 'overdue') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
  }

  const totalBills = vendors.reduce((s, v) => s + v.invoices.length, 0)
  const overdue  = vendors.reduce((s, v) => s + v.invoices.filter(i => i.status === 'overdue').length, 0)
  const partial  = vendors.reduce((s, v) => s + v.invoices.filter(i => i.status === 'partial').length, 0)
  const paid     = vendors.reduce((s, v) => s + v.invoices.filter(i => i.status === 'paid').length, 0)

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
          <p className="text-sm text-gray-500 mt-1">{totalBills} supplier bills</p>
        </div>
        <button onClick={fetchPayables}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          ↻ Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Owed', value: `₹${Number(total).toLocaleString()}`, sub: `${totalBills} total bills`, color: 'red', badge: 'You Owe' },
          { label: 'Overdue', value: overdue, sub: 'bills past due date', color: 'red' },
          { label: 'Partial', value: partial, sub: 'partially paid', color: 'yellow' },
          { label: 'Paid', value: paid, sub: 'fully settled', color: 'green' },
        ].map(card => (
          <div key={card.label} className={`bg-white border border-${card.color}-100 rounded-xl p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.label}</span>
              {card.badge && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">{card.badge}</span>}
            </div>
            <p className={`text-2xl font-bold text-${card.color}-${card.color === 'green' ? '600' : '500'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-2">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Vendor-wise list */}
      <div className="space-y-3">
        {vendors.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
            No pending payables 🎉
          </div>
        )}
        {vendors.map(vendor => (
          <div key={vendor.vendor_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Vendor Header Row */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleVendor(vendor.vendor_id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  {vendor.vendor[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{vendor.vendor}</p>
                  <p className="text-xs text-gray-400">{vendor.invoices.length} invoice{vendor.invoices.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">₹{Number(vendor.total).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Paid</p>
                  <p className="font-semibold text-green-600">₹{Number(vendor.paid).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Balance Due</p>
                  <p className={`font-bold text-lg ${vendor.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{Number(vendor.balance).toLocaleString()}
                  </p>
                </div>
                <span className="text-slate-400 text-sm">{expanded[vendor.vendor_id] ? '▼' : '▶'}</span>
              </div>
            </div>

            {/* Expanded PO/Invoice list */}
            {expanded[vendor.vendor_id] && (
              <div className="border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase text-gray-400">
                      <th className="px-5 py-2 text-left">Invoice No</th>
                      <th className="px-5 py-2 text-left">PO Number</th>
                      <th className="px-5 py-2 text-left">Date</th>
                      <th className="px-5 py-2 text-right">Total</th>
                      <th className="px-5 py-2 text-right">Paid</th>
                      <th className="px-5 py-2 text-right">Balance</th>
                      <th className="px-5 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vendor.invoices.map((inv, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{inv.invoice_no}</td>
                        <td className="px-5 py-3 text-gray-600">{inv.po_number}</td>
                        <td className="px-5 py-3 text-gray-500">{inv.invoice_date}</td>
                        <td className="px-5 py-3 text-right text-gray-700">₹{Number(inv.total).toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-green-600">₹{Number(inv.paid).toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-semibold text-red-600">₹{Number(inv.balance).toLocaleString()}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}