import { useEffect, useState } from 'react'
import api from '../api/client'

const StatCard = ({ label, value, sub, color }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
    <p className="text-sm text-slate-500 mb-1">{label}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
)

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [itc, setItc] = useState(null)
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [salesRes, itcRes, stockRes] = await Promise.all([
          api.get('/sales/summary'),
          api.get('/accounting/itc-utilisation'),
          api.get('/accounting/stock-report'),
        ])
        setSummary(salesRes.data)
        setItc(itcRes.data)
        setStock(stockRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400">Loading dashboard...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">GST Manufacturing Overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Sales"
          value={`₹${Number(summary?.total_sales_value || 0).toLocaleString('en-IN')}`}
          sub={`${summary?.total_invoices || 0} invoices`}
          color="text-slate-800"
        />
        <StatCard
          label="GST Collected"
          value={`₹${Number(summary?.total_gst_collected || 0).toLocaleString('en-IN')}`}
          sub="This period"
          color="text-teal-600"
        />
        <StatCard
          label="ITC Available"
          value={`₹${Number(itc?.total_itc_available || 0).toLocaleString('en-IN')}`}
          sub="Claimable credit"
          color="text-violet-600"
        />
        <StatCard
          label="Outstanding"
          value={`₹${Number(summary?.outstanding_amount || 0).toLocaleString('en-IN')}`}
          sub="Unpaid invoices"
          color="text-amber-600"
        />
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Current Stock</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="px-5 py-3 text-left">Item</th>
                <th className="px-5 py-3 text-left">HSN</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Unit</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3 text-right">Tax Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stock.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{item.name}</td>
                  <td className="px-5 py-3 text-slate-500">{item.hsn_code}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.item_type === 'finished_good'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.item_type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{item.unit}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-700">
                    {Number(item.current_stock).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">{item.tax_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}