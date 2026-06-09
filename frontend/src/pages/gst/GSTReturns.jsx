import { useState } from 'react'
import api from '../../api/client'
import { exportToExcel } from "../utils/exportToExcel";

export default function GSTReturns() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0]

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [gstr1, setGstr1] = useState(null)
  const [gstr3b, setGstr3b] = useState(null)
  const [activeTab, setActiveTab] = useState('gstr1')
  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (fromDate > toDate) {
      alert('"From" date cannot be after "To" date')
      return
    }
    setLoading(true)
    try {
      const [r1, r3b] = await Promise.all([
        api.get(`/gst/gstr1?from_date=${fromDate}&to_date=${toDate}`),
        api.get(`/gst/gstr3b?from_date=${fromDate}&to_date=${toDate}`),
      ])
      setGstr1(r1.data)
      setGstr3b(r3b.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (type) => {
    try {
      await api.post(`/gst/save/${type}?from_date=${fromDate}&to_date=${toDate}`)
      alert(`${type} saved successfully for ${fromDate} to ${toDate}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving return')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">GST Returns</h1>
        <p className="text-slate-500 text-sm mt-1">Auto-generated from your transactions</p>
      </div>

      {/* Date range selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Quick presets */}
          <div className="pt-5 flex gap-2">
            {[
              { label: 'This Month', fn: () => {
                  const now = new Date()
                  setFromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
                  setToDate(now.toISOString().split('T')[0])
              }},
              { label: 'Last Month', fn: () => {
                  const now = new Date()
                  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                  const last = new Date(now.getFullYear(), now.getMonth(), 0)
                  setFromDate(first.toISOString().split('T')[0])
                  setToDate(last.toISOString().split('T')[0])
              }},
              { label: 'This Quarter', fn: () => {
                  const now = new Date()
                  const qStart = Math.floor(now.getMonth() / 3) * 3
                  setFromDate(new Date(now.getFullYear(), qStart, 1).toISOString().split('T')[0])
                  setToDate(now.toISOString().split('T')[0])
              }},
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pt-5">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Generate Returns'}
            </button>
            // Inside your component, add this button next to "Generate Returns":
<button
  onClick={() => {
    exportToExcel([
      {
        name: "GSTR-1 B2B Invoices",
        data: b2bInvoices.map((inv) => ({
          Customer: inv.customer_name,
          GSTIN: inv.gstin,
          Invoice: inv.invoice_number,
          Date: inv.date,
          Type: inv.tax_type,
          "Taxable (₹)": inv.taxable_value,
          "Tax (₹)": inv.tax_amount,
          "Total (₹)": inv.total_amount,
        })),
      },
      {
        name: "HSN Summary",
        data: hsnSummary.map((h) => ({
          "HSN Code": h.hsn_code,
          Description: h.description,
          Quantity: h.quantity,
          "Taxable Value (₹)": h.taxable_value,
          "IGST (₹)": h.igst,
          "CGST (₹)": h.cgst,
          "SGST (₹)": h.sgst,
        })),
      },
    ], `GST_Returns_${fromDate}_${toDate}`);
  }}
  className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 flex items-center gap-2"
>
  ⬇ Export Excel
</button>
          </div>
        </div>
      </div>
    
    
      {/* Tabs */}
      {(gstr1 || gstr3b) && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('gstr1')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'gstr1'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              GSTR-1
            </button>
            <button
              onClick={() => setActiveTab('gstr3b')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'gstr3b'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              GSTR-3B
            </button>
          </div>

          {/* GSTR-1 */}
          {activeTab === 'gstr1' && gstr1 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-700">GSTR-1 — {gstr1.period}</h2>
                    <p className="text-sm text-slate-500">{gstr1.total_invoices} invoices</p>
                  </div>
                  <button
                    onClick={() => handleSave('GSTR1')}
                    className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium"
                  >
                    Save Draft
                  </button>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Taxable Value', val: gstr1.totals?.total_taxable_value, color: 'text-slate-800' },
                    { label: 'CGST', val: gstr1.totals?.total_cgst, color: 'text-blue-600' },
                    { label: 'SGST', val: gstr1.totals?.total_sgst, color: 'text-blue-600' },
                    { label: 'IGST', val: gstr1.totals?.total_igst, color: 'text-violet-600' },
                  ].map((t, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">{t.label}</p>
                      <p className={`text-lg font-bold ${t.color}`}>
                        ₹{Number(t.val || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* B2B Invoices */}
              {gstr1.b2b_invoices?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700">B2B Invoices</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Sales to GST registered customers</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                          <th className="px-5 py-3 text-left">Customer</th>
                          <th className="px-5 py-3 text-left">GSTIN</th>
                          <th className="px-5 py-3 text-left">Invoice</th>
                          <th className="px-5 py-3 text-left">Date</th>
                          <th className="px-5 py-3 text-center">Type</th>
                          <th className="px-5 py-3 text-right">Taxable</th>
                          <th className="px-5 py-3 text-right">Tax</th>
                          <th className="px-5 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {gstr1.b2b_invoices.map((inv, i) => {
                          const tax = Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst)
                          return (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-medium text-slate-700">{inv.customer_name}</td>
                              <td className="px-5 py-3 font-mono text-xs text-slate-500">{inv.customer_gstin}</td>
                              <td className="px-5 py-3 text-slate-600">{inv.invoice_number}</td>
                              <td className="px-5 py-3 text-slate-500">{inv.invoice_date}</td>
                              <td className="px-5 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  inv.is_interstate ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {inv.is_interstate ? 'IGST' : 'CGST+SGST'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600">₹{Number(inv.taxable_value).toLocaleString('en-IN')}</td>
                              <td className="px-5 py-3 text-right text-teal-600 font-medium">₹{tax.toLocaleString('en-IN')}</td>
                              <td className="px-5 py-3 text-right font-bold text-slate-800">₹{Number(inv.invoice_value).toLocaleString('en-IN')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HSN Summary */}
              {gstr1.hsn_summary?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700">HSN-wise Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                          <th className="px-5 py-3 text-left">HSN Code</th>
                          <th className="px-5 py-3 text-left">Description</th>
                          <th className="px-5 py-3 text-right">Quantity</th>
                          <th className="px-5 py-3 text-right">Taxable Value</th>
                          <th className="px-5 py-3 text-right">IGST</th>
                          <th className="px-5 py-3 text-right">CGST</th>
                          <th className="px-5 py-3 text-right">SGST</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {gstr1.hsn_summary.map((hsn, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-mono font-medium text-slate-700">{hsn.hsn_code}</td>
                            <td className="px-5 py-3 text-slate-600">{hsn.description}</td>
                            <td className="px-5 py-3 text-right text-slate-600">{Number(hsn.total_quantity).toLocaleString('en-IN')} {hsn.uom}</td>
                            <td className="px-5 py-3 text-right text-slate-700">₹{Number(hsn.taxable_value).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right text-violet-600">₹{Number(hsn.igst).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right text-blue-600">₹{Number(hsn.cgst).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right text-blue-600">₹{Number(hsn.sgst).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {gstr1.total_invoices === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                  No invoices found for {months[month - 1]} {year}
                </div>
              )}
            </div>
          )}

          {/* GSTR-3B */}
          {activeTab === 'gstr3b' && gstr3b && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-semibold text-slate-700">GSTR-3B — {gstr3b.period}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{gstr3b.summary}</p>
                  </div>
                  <button
                    onClick={() => handleSave('GSTR3B')}
                    className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium"
                  >
                    Save Draft
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Tax Collected */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tax Collected (Sales)</p>
                    <div className="space-y-2">
                      {['cgst', 'sgst', 'igst'].map(type => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-slate-500 uppercase">{type}</span>
                          <span className="font-medium text-slate-700">
                            ₹{Number(gstr3b.tax_collected?.[type] || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                        <span>Total</span>
                        <span className="text-slate-800">₹{Number(gstr3b.tax_collected?.total || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* ITC Available */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">ITC Available (Purchases)</p>
                    <div className="space-y-2">
                      {['cgst', 'sgst', 'igst'].map(type => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-green-600 uppercase">{type}</span>
                          <span className="font-medium text-green-700">
                            ₹{Number(gstr3b.itc_available?.[type] || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-green-200">
                        <span className="text-green-700">Total ITC</span>
                        <span className="text-green-700">₹{Number(gstr3b.itc_available?.total || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Payable */}
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Net Payable to Govt</p>
                    <div className="space-y-2">
                      {['cgst', 'sgst', 'igst'].map(type => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-amber-600 uppercase">{type}</span>
                          <span className="font-medium text-amber-700">
                            ₹{Number(gstr3b.net_payable?.[type] || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-200">
                        <span className="text-amber-700">Total</span>
                        <span className="text-amber-700 text-lg">
                          ₹{Number(gstr3b.net_payable?.total || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}