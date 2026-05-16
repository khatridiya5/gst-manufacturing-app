import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function Reports() {
  const [pnl, setPnl] = useState(null)
  const [itc, setItc] = useState(null)
  const [outstanding, setOutstanding] = useState(null)
  const [costAnalysis, setCostAnalysis] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(5)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const [pnlRes, itcRes, outRes, costRes] = await Promise.all([
        api.get(`/accounting/pnl?year=${year}&month=${month}`),
        api.get('/accounting/itc-utilisation'),
        api.get('/accounting/outstanding'),
        api.get('/accounting/cost-analysis'),
      ])
      setPnl(pnlRes.data)
      setItc(itcRes.data)
      setOutstanding(outRes.data)
      setCostAnalysis(costRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [])

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">P&L, ITC utilisation, cost analysis</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchReports} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Refresh</button>
        </div>
      </div>

      {/* P&L */}
      {pnl && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-4">
          <h2 className="font-semibold text-slate-700 mb-4">P&L — {pnl.period}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-teal-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3">Income</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Sales Revenue</span><span className="font-medium text-slate-700">₹{Number(pnl.income?.sales_revenue || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Invoices</span><span className="font-medium text-slate-700">{pnl.income?.total_invoices}</span></div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Expenses</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Raw Materials</span><span className="font-medium text-slate-700">₹{Number(pnl.expenses?.raw_material_purchase || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Production Cost</span><span className="font-medium text-slate-700">₹{Number(pnl.expenses?.production_cost || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between font-semibold border-t border-red-200 pt-2"><span>Total</span><span>₹{Number(pnl.expenses?.total_expenses || 0).toLocaleString('en-IN')}</span></div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Profit</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Gross Profit</span><span className="font-bold text-white text-lg">₹{Number(pnl.profit?.gross_profit || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Margin</span><span className="font-medium text-teal-400">{pnl.profit?.gross_margin}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">GST Payable</span><span className="font-medium text-amber-400">₹{Number(pnl.gst?.net_gst_payable || 0).toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITC Utilisation */}
      {itc && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-4">
          <h2 className="font-semibold text-slate-700 mb-4">ITC Utilisation</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total ITC Available', val: itc.total_itc_available, color: 'text-green-600' },
              { label: 'ITC Utilised', val: itc.itc_utilised, color: 'text-teal-600' },
              { label: 'Carry Forward', val: itc.itc_balance_carry_forward, color: 'text-violet-600' },
              { label: 'Net Cash to Govt', val: itc.net_cash_paid_to_govt, color: 'text-amber-600' },
            ].map((s, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>₹{Number(s.val || 0).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Analysis */}
      {costAnalysis.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Production Cost vs Selling Price</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="px-5 py-3 text-left">Item</th>
                <th className="px-5 py-3 text-left">HSN</th>
                <th className="px-5 py-3 text-right">Avg Cost</th>
                <th className="px-5 py-3 text-right">Avg Selling</th>
                <th className="px-5 py-3 text-right">Margin</th>
                <th className="px-5 py-3 text-right">Margin %</th>
                <th className="px-5 py-3 text-right">Units Produced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {costAnalysis.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{c.item}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{c.hsn_code}</td>
                  <td className="px-5 py-3 text-right text-slate-600">₹{Number(c.avg_production_cost).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right text-slate-600">₹{Number(c.avg_selling_price).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right font-semibold text-green-600">₹{Number(c.margin).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right font-bold text-teal-600">{c.margin_percentage}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{c.total_units_produced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outstanding */}
      {outstanding && outstanding.invoice_count > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Outstanding Payments</h2>
            <span className="text-amber-600 font-bold">₹{Number(outstanding.total_outstanding).toLocaleString('en-IN')} pending</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="px-5 py-3 text-left">Invoice</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Invoice Date</th>
                <th className="px-5 py-3 text-left">Due Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {outstanding.invoices.map((inv, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-slate-600">{inv.customer}</td>
                  <td className="px-5 py-3 text-slate-500">{inv.invoice_date}</td>
                  <td className="px-5 py-3 text-slate-500">{inv.due_date || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-amber-600">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}