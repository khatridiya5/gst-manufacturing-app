import { useEffect, useState } from 'react'
import api from '../../api/client'
import { exportToExcel } from '../utils/exportToExcel'

const StatusBadge = ({ status }) => {
  const colors = {
    unpaid: 'bg-amber-50 text-amber-700',
    paid: 'bg-green-50 text-green-700',
    partial: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export default function SalesInvoices() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [sortOrder, setSortOrder] = useState('newest')

  // Form state
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [lineItems, setLineItems] = useState([{ item_id: '', quantity: '', unit_price: '' }])

  const fetchAll = async () => {
    try {
      const [invRes, custRes, itemsRes] = await Promise.all([
        api.get('/sales/invoices'),
        api.get('/master/customers'),
        api.get('/master/items'),
      ])
      setInvoices(invRes.data)
      setCustomers(custRes.data)
      setItems(itemsRes.data.filter(i => i.item_type === 'finished_good'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleAddLine = () => {
    setLineItems([...lineItems, { item_id: '', quantity: '', unit_price: '' }])
  }

  const handleLineChange = (i, field, value) => {
    const updated = [...lineItems]
    updated[i][field] = value
    setLineItems(updated)
  }

  const handleRemoveLine = (i) => {
    setLineItems(lineItems.filter((_, idx) => idx !== i))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/sales/invoices', {
        customer_id: parseInt(customerId),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        line_items: lineItems.map(li => ({
          item_id: parseInt(li.item_id),
          quantity: parseFloat(li.quantity),
          unit_price: parseFloat(li.unit_price),
        }))
      })
      setShowForm(false)
      setCustomerId('')
      setLineItems([{ item_id: '', quantity: '', unit_price: '' }])
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error creating invoice')
    }
  }

  const handleMarkPaid = async (invoiceId) => {
    try {
      await api.patch(`/sales/invoices/${invoiceId}/paid`)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleViewInvoice = async (invoiceId) => {
    try {
      const res = await api.get(`/sales/invoices/${invoiceId}`)
      setSelectedInvoice(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || '—'

  const totalSales = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0)
  const totalGST = invoices.reduce((sum, i) => sum + Number(i.cgst_amount) + Number(i.sgst_amount) + Number(i.igst_amount), 0)
  const unpaidCount = invoices.filter(i => i.payment_status === 'unpaid').length

  const sortedInvoices = [...invoices].sort((a, b) =>
  sortOrder === 'newest'
    ? new Date(b.invoice_date) - new Date(a.invoice_date)
    : new Date(a.invoice_date) - new Date(b.invoice_date)
)

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">{invoices.length} total invoices</p>
        </div>
        <div className="flex items-center gap-3">
  <select
    value={sortOrder}
    onChange={(e) => setSortOrder(e.target.value)}
    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-teal-500"
  >
    <option value="newest">Newest First</option>
    <option value="oldest">Oldest First</option>
  </select>
  <button
    onClick={() => setShowForm(!showForm)}
    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
  >
    + New Invoice
  </button>
  <button
  onClick={() => {
    exportToExcel([
      {
        name: "Sales Invoices",
        data: sortedInvoices.map((inv) => {
          const gst = Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount)
          return {
            "Invoice No.": inv.invoice_number,
            Customer: getCustomerName(inv.customer_id),
            Date: inv.invoice_date,
            Type: inv.is_interstate ? "IGST" : "CGST+SGST",
            "Subtotal (₹)": Number(inv.subtotal),
            "CGST (₹)": Number(inv.cgst_amount),
            "SGST (₹)": Number(inv.sgst_amount),
            "IGST (₹)": Number(inv.igst_amount),
            "GST Total (₹)": gst,
            "Total (₹)": Number(inv.total_amount),
            "Payment Status": inv.payment_status,
          }
        }),
      },
    ], "Sales_Invoices")
  }}
  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
>
  ⬇ Export Excel
</button>
</div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Total Sales</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            ₹{totalSales.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">GST Collected</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">
            ₹{totalGST.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">Unpaid Invoices</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{unpaidCount}</p>
        </div>
      </div>

      {/* Create Invoice Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Create Sales Invoice</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Items</label>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <select
                      value={li.item_id}
                      onChange={(e) => handleLineChange(i, 'item_id', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    >
                      <option value="">Select item...</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={li.quantity}
                      onChange={(e) => handleLineChange(i, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Unit Price (₹)"
                      value={li.unit_price}
                      onChange={(e) => handleLineChange(i, 'unit_price', e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(i)}
                      className="px-3 py-2 text-red-400 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="mt-2 text-sm text-teal-600 hover:text-teal-500"
              >
                + Add item
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
              >
                Create Invoice
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3 text-left">Invoice No.</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-center">Type</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
                <th className="px-5 py-3 text-right">GST</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    No invoices yet. Create your first sales invoice.
                  </td>
                </tr>
              )}
              {sortedInvoices.map((inv) => {
                const gst = Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount)
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-slate-600">{getCustomerName(inv.customer_id)}</td>
                    <td className="px-5 py-3 text-slate-500">{inv.invoice_date}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        inv.is_interstate
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {inv.is_interstate ? 'IGST' : 'CGST+SGST'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      ₹{Number(inv.subtotal).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right text-teal-600 font-medium">
                      ₹{gst.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={inv.payment_status} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewInvoice(inv.id)}
                          className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium"
                        >
                          View
                        </button>
                        {inv.payment_status === 'unpaid' && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">{selectedInvoice.invoice_number}</h2>
                <p className="text-slate-500 text-sm">{selectedInvoice.customer} · {selectedInvoice.invoice_date}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tax type */}
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedInvoice.is_interstate
                    ? 'bg-violet-50 text-violet-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {selectedInvoice.is_interstate ? 'Interstate — IGST Applied' : 'Intrastate — CGST + SGST Applied'}
                </span>
                {selectedInvoice.eway_bill_required && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    E-Way Bill Required
                  </span>
                )}
              </div>

              {/* Line items */}
              <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Tax</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedInvoice.line_items?.map((li, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-700">Item #{li.item_id}</td>
                      <td className="px-4 py-2 text-right">{li.quantity}</td>
                      <td className="px-4 py-2 text-right">₹{Number(li.unit_price).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right text-teal-600">
                        {li.igst > 0
                          ? `IGST ₹${Number(li.igst).toLocaleString('en-IN')}`
                          : `CGST ₹${Number(li.cgst).toLocaleString('en-IN')} + SGST ₹${Number(li.sgst).toLocaleString('en-IN')}`
                        }
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">₹{Number(li.total).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700">₹{Number(selectedInvoice.subtotal).toLocaleString('en-IN')}</span>
                </div>
                {Number(selectedInvoice.cgst) > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">CGST</span>
                      <span className="text-slate-700">₹{Number(selectedInvoice.cgst).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">SGST</span>
                      <span className="text-slate-700">₹{Number(selectedInvoice.sgst).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                {Number(selectedInvoice.igst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">IGST</span>
                    <span className="text-slate-700">₹{Number(selectedInvoice.igst).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span className="text-teal-600">₹{Number(selectedInvoice.total).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}