import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DEFAULT_COMPANY = {
  name: 'Your Company Name',
  logo: '',
  address: 'Your Address, City, State - PIN',
  gstin: '24XXXXX0000X1ZX',
  phone: '9876543210',
  email: 'company@email.com',
  bank_name: 'Bank Name',
  account_no: '000000000000',
  ifsc: 'BANK0000000',
  branch: 'Branch Name',
  state: 'Gujarat',
  state_code: '24',
  watermark: '',
}

export default function InvoicePrint() {
  const [searchParams] = useSearchParams()
  const invoiceId = searchParams.get('id')

  const [company, setCompany] = useState(() => {
    const saved = localStorage.getItem('company_profile')
    return saved ? JSON.parse(saved) : DEFAULT_COMPANY
  })
  const [editingCompany, setEditingCompany] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [selectedId, setSelectedId] = useState(invoiceId || '')

  // Manual invoice mode
  const [manualMode, setManualMode] = useState(!invoiceId)
  const [manualInvoice, setManualInvoice] = useState({
    invoice_number: '', invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '', customer_address: '', customer_gstin: '', customer_state: '', customer_state_code: '',
    line_items: [{ description: '', hsn_code: '', qty: '', unit: 'NOS', rate: '', amount: '' }],
    is_interstate: true, tax_rate: 18, notes: '',
  })

  useEffect(() => {
    api.get('/sales/invoices').then(res => setInvoices(res.data)).catch(console.error)
    if (invoiceId) loadInvoice(invoiceId)
  }, [])

  const loadInvoice = async (id) => {
    try {
      const res = await api.get(`/sales/invoices/${id}`)
      setInvoice(res.data)
      setManualMode(false)
    } catch (err) { console.error(err) }
  }

  const saveCompany = () => {
    localStorage.setItem('company_profile', JSON.stringify(company))
    setEditingCompany(false)
  }

  // Calculate manual invoice totals
  const calcManual = () => {
    const lines = manualInvoice.line_items.map(li => ({
      ...li,
      amount: parseFloat(li.qty || 0) * parseFloat(li.rate || 0)
    }))
    const subtotal = lines.reduce((s, l) => s + l.amount, 0)
    const taxAmount = subtotal * manualInvoice.tax_rate / 100
    return { lines, subtotal, taxAmount, total: subtotal + taxAmount }
  }

  const handleManualLineChange = (i, field, value) => {
    const updated = [...manualInvoice.line_items]
    updated[i][field] = value
    setManualInvoice({ ...manualInvoice, line_items: updated })
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF()
    // Watermark
  doc.setTextColor(230, 230, 230)
  doc.setFontSize(50)
  doc.text(company.watermark ||company.name, 35, 160, {
    angle: 45,
  })
doc.setTextColor(0, 0, 0)
    if (company.logo) {
  doc.addImage(
    company.logo,
    'PNG',
    14,
    10,
    28,
    28
  )
}
    const isManual = manualMode

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(company.name, 120, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(company.address, 120, 24, { align: 'center' })
    doc.text(`Phone: ${company.phone}  |  Email: ${company.email}`, 120, 29, { align: 'center' })
    doc.text(`GSTIN: ${company.gstin}`, 120, 34, { align: 'center' })

    // Title
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 38, 210, 8, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('TAX INVOICE', 105, 44, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    // Invoice details
    const invNum = isManual ? manualInvoice.invoice_number : invoice?.invoice_number
    const invDate = isManual ? manualInvoice.invoice_date : invoice?.invoice_date
    const custName = isManual ? manualInvoice.customer_name : invoice?.customer
    const custGSTIN = isManual ? manualInvoice.customer_gstin : ''
    const custAddr = isManual ? manualInvoice.customer_address : ''
    const custState = isManual ? manualInvoice.customer_state : ''
    const custStateCode = isManual ? manualInvoice.customer_state_code : ''

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', 14, 54)
    doc.setFont('helvetica', 'normal')
    doc.text(custName || '', 14, 59)
    doc.text(custAddr || '', 14, 64)
    if (custGSTIN) doc.text(`GSTIN: ${custGSTIN}`, 14, 69)
    if (custState) doc.text(`State: ${custState}  Code: ${custStateCode}`, 14, 74)

    doc.setFont('helvetica', 'bold')
    doc.text('Invoice No:', 130, 54)
    doc.setFont('helvetica', 'normal')
    doc.text(invNum || '', 165, 54)
    doc.setFont('helvetica', 'bold')
    doc.text('Date:', 130, 59)
    doc.setFont('helvetica', 'normal')
    doc.text(invDate || '', 165, 59)

    // Line items
    let tableData = []
    if (isManual) {
      const { lines } = calcManual()
      tableData = lines.map((li, i) => [
        i + 1, li.description, li.hsn_code, li.qty, li.unit,
        `₹${parseFloat(li.rate || 0).toFixed(2)}`,
        `₹${li.amount.toFixed(2)}`
      ])
    } else if (invoice?.line_items) {
      tableData = invoice.line_items.map((li, i) => [
        i + 1, `Item #${li.item_id}`, '', li.quantity, 'NOS',
        `₹${parseFloat(li.unit_price).toFixed(2)}`,
        `₹${(parseFloat(li.quantity) * parseFloat(li.unit_price)).toFixed(2)}`
      ])
    }

    autoTable(doc, {
      startY: 80,
      head: [['#', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 10 }, 6: { halign: 'right' } }
    })

    const finalY = doc.lastAutoTable.finalY + 5

    // Totals
    let subtotal, taxLabel, taxAmount, total
    if (isManual) {
      const calc = calcManual()
      subtotal = calc.subtotal
      taxLabel = manualInvoice.is_interstate ? `IGST @${manualInvoice.tax_rate}%` : `CGST+SGST @${manualInvoice.tax_rate}%`
      taxAmount = calc.taxAmount
      total = calc.total
    } else {
      subtotal = parseFloat(invoice?.subtotal || 0)
      const igst = parseFloat(invoice?.igst || 0)
      const cgst = parseFloat(invoice?.cgst || 0)
      const sgst = parseFloat(invoice?.sgst || 0)
      taxLabel = igst > 0 ? 'IGST' : 'CGST + SGST'
      taxAmount = igst > 0 ? igst : cgst + sgst
      total = parseFloat(invoice?.total || 0)
    }

    doc.setFontSize(9)
    doc.text(`Basic Amount:`, 140, finalY)
    doc.text(`₹${subtotal.toFixed(2)}`, 195, finalY, { align: 'right' })
    doc.text(`${taxLabel}:`, 140, finalY + 5)
    doc.text(`₹${taxAmount.toFixed(2)}`, 195, finalY + 5, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(`Total:`, 140, finalY + 10)
    doc.text(`₹${total.toFixed(2)}`, 195, finalY + 10, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    // Bank details
    doc.setFontSize(8)
    doc.text('Bank Details:', 14, finalY + 20)
    doc.text(`Bank: ${company.bank_name}  |  A/C: ${company.account_no}  |  IFSC: ${company.ifsc}  |  Branch: ${company.branch}`, 14, finalY + 25)

    // Footer
    doc.text('Terms: Goods once sold will not be taken back. Subject to local jurisdiction.', 14, finalY + 35)
    doc.setFont('helvetica', 'bold')
    doc.text(`For ${company.name}`, 150, finalY + 40)
    doc.text('(Authorised Signatory)', 150, finalY + 50)

    doc.save(`${invNum || 'invoice'}.pdf`)
  }

  const { lines: manualLines, subtotal: manualSubtotal, taxAmount: manualTax, total: manualTotal } = calcManual()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoice Generator</h1>
          <p className="text-slate-500 text-sm mt-1">Print or download GST tax invoice</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditingCompany(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">⚙️ Company Profile</button>
          <button onClick={() => setManualMode(false)} className={`px-4 py-2 rounded-lg text-sm font-medium ${!manualMode ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>From System</button>
          <button onClick={() => setManualMode(true)} className={`px-4 py-2 rounded-lg text-sm font-medium ${manualMode ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Manual Entry</button>
        </div>
      </div>

      {/* Company Profile Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <h2 className="font-semibold text-slate-700 mb-4">Company Profile — appears on every invoice</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Company Name', key: 'name' },
                { label: 'GSTIN', key: 'gstin' },
                { label: 'Phone', key: 'phone' },
                { label: 'Email', key: 'email' },
                { label: 'State', key: 'state' },
                { label: 'State Code', key: 'state_code' },
                { label: 'Bank Name', key: 'bank_name' },
                { label: 'Account No', key: 'account_no' },
                { label: 'IFSC Code', key: 'ifsc' },
                { label: 'Branch', key: 'branch' },
                { label: 'Watermark Text', key: 'watermark' },
        

              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
                  <input value={company[f.key]} onChange={e => setCompany({...company, [f.key]: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Address</label>
                <textarea value={company.address} onChange={e => setCompany({...company, address: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div className="col-span-2">
  <label className="block text-sm font-medium text-slate-600 mb-1">
    Company Logo
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files[0]

      if (file) {
        const reader = new FileReader()

        reader.onloadend = () => {
          setCompany({
            ...company,
            logo: reader.result
          })
        }

        reader.readAsDataURL(file)
      }
    }}
    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
  />

  {company.logo && (
    <img
      src={company.logo}
      alt="Company Logo"
      className="h-20 mt-3 object-contain border rounded-lg p-2"
    />
  )}
</div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveCompany} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">Save Profile</button>
              <button onClick={() => setEditingCompany(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* From System Mode */}
      {!manualMode && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-600 mb-2">Select Invoice from System</label>
          <div className="flex gap-3">
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
              <option value="">Select invoice...</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.invoice_date} — ₹{Number(inv.total_amount).toLocaleString('en-IN')}</option>
              ))}
            </select>
            <button onClick={() => loadInvoice(selectedId)} disabled={!selectedId} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 text-white rounded-lg text-sm font-medium">Load</button>
          </div>
        </div>
      )}

      {/* Manual Mode */}
      {manualMode && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Manual Invoice Entry</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Invoice Number</label>
              <input value={manualInvoice.invoice_number} onChange={e => setManualInvoice({...manualInvoice, invoice_number: e.target.value})} placeholder="INV-001" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Invoice Date</label>
              <input type="date" value={manualInvoice.invoice_date} onChange={e => setManualInvoice({...manualInvoice, invoice_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tax Rate (%)</label>
              <select value={manualInvoice.tax_rate} onChange={e => setManualInvoice({...manualInvoice, tax_rate: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
                {[5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Customer Name</label>
              <input value={manualInvoice.customer_name} onChange={e => setManualInvoice({...manualInvoice, customer_name: e.target.value})} placeholder="Tata Motors Ltd" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Customer GSTIN</label>
              <input value={manualInvoice.customer_gstin} onChange={e => setManualInvoice({...manualInvoice, customer_gstin: e.target.value})} placeholder="27AAACT2727Q1ZV" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Customer State</label>
              <input value={manualInvoice.customer_state} onChange={e => setManualInvoice({...manualInvoice, customer_state: e.target.value})} placeholder="Maharashtra" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-slate-600 mb-1">Customer Address</label>
              <input value={manualInvoice.customer_address} onChange={e => setManualInvoice({...manualInvoice, customer_address: e.target.value})} placeholder="123, Industrial Area, City" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Transaction Type</label>
              <select value={manualInvoice.is_interstate} onChange={e => setManualInvoice({...manualInvoice, is_interstate: e.target.value === 'true'})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500">
                <option value="true">Interstate (IGST)</option>
                <option value="false">Intrastate (CGST+SGST)</option>
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Items</label>
            {manualInvoice.line_items.map((li, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 mb-2">
                <input value={li.description} onChange={e => handleManualLineChange(i, 'description', e.target.value)} placeholder="Description" className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                <input value={li.hsn_code} onChange={e => handleManualLineChange(i, 'hsn_code', e.target.value)} placeholder="HSN Code" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                <input type="number" value={li.qty} onChange={e => handleManualLineChange(i, 'qty', e.target.value)} placeholder="Qty" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                <input type="number" value={li.rate} onChange={e => handleManualLineChange(i, 'rate', e.target.value)} placeholder="Rate ₹" className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
                <button type="button" onClick={() => setManualInvoice({...manualInvoice, line_items: manualInvoice.line_items.filter((_,idx)=>idx!==i)})} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setManualInvoice({...manualInvoice, line_items: [...manualInvoice.line_items, { description:'', hsn_code:'', qty:'', unit:'NOS', rate:'', amount:'' }]})} className="text-sm text-teal-600 hover:text-teal-500">+ Add item</button>
          </div>
        </div>
      )}

      {/* Invoice Preview */}
      {(invoice || manualMode) && (
        <div id="invoice-preview" className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Action buttons */}
          <div className="flex gap-2 p-4 border-b border-slate-100 justify-end">
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">🖨️ Print</button>
            <button onClick={handleDownloadPDF} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium">⬇️ Download PDF</button>
          </div>

          {/* Invoice layout */}
          <div className="p-8 print:p-6 relative overflow-hidden" >
           {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1
              className="text-[100px] font-bold text-slate-200 opacity-10 rotate-[-30deg]"
                >
              {company.watermark || company.name}
            </h1>
            </div> 
            {/* Company header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-4">
            <div className="flex items-center justify-between">

    {/* Logo */}
    <div className="w-28">
      {company.logo && (
        <img
          src={company.logo}
          alt="Logo"
          className="h-20 object-contain"
        />
      )}
    </div>

    {/* Company Details */}
    <div className="text-center flex-1">
      <h1 className="text-2xl font-bold text-slate-800">
        {company.name}
      </h1>

      <p className="text-sm text-slate-600 mt-1">
        {company.address}
      </p>

      <p className="text-sm text-slate-600">
        (M): {company.phone} · {company.email}
      </p>

      <p className="text-sm font-semibold text-slate-700 mt-1">
        GSTIN: {company.gstin}
      </p>
    </div>

    {/* Empty right spacing */}
    <div className="w-28"></div>

  </div>
</div>

            {/* TAX INVOICE title */}
            <div className="bg-slate-800 text-white text-center py-2 rounded mb-4">
              <h2 className="font-bold text-sm tracking-widest">TAX INVOICE — Original for Recipient</h2>
            </div>

            {/* Bill to + Invoice details */}
            <div className="grid grid-cols-2 gap-4 mb-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-r border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Bill To</p>
                <p className="font-bold text-slate-800">{manualMode ? manualInvoice.customer_name : invoice?.customer}</p>
                {manualMode && <p className="text-sm text-slate-600 mt-1">{manualInvoice.customer_address}</p>}
                {manualMode && manualInvoice.customer_gstin && <p className="text-sm text-slate-600">GSTIN: {manualInvoice.customer_gstin}</p>}
                {manualMode && manualInvoice.customer_state && <p className="text-sm text-slate-600">State: {manualInvoice.customer_state} · Code: {manualInvoice.customer_state_code}</p>}
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500 font-medium">Invoice No:</span>
                  <span className="font-bold text-slate-800">{manualMode ? manualInvoice.invoice_number : invoice?.invoice_number}</span>
                  <span className="text-slate-500 font-medium">Date:</span>
                  <span className="text-slate-700">{manualMode ? manualInvoice.invoice_date : invoice?.invoice_date}</span>
                  <span className="text-slate-500 font-medium">Seller GSTIN:</span>
                  <span className="font-mono text-xs text-slate-700">{company.gstin}</span>
                  <span className="text-slate-500 font-medium">Place of Supply:</span>
                  <span className="text-slate-700">{manualMode ? (manualInvoice.is_interstate ? manualInvoice.customer_state : company.state) : company.state}</span>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-4">
              <thead>
                <tr className="bg-slate-800 text-white text-xs uppercase">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-center">HSN</th>
                  <th className="px-3 py-2 text-center">Qty</th>
                  <th className="px-3 py-2 text-center">Unit</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualMode ? manualLines.map((li, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-500">{i+1}</td>
                    <td className="px-3 py-2 text-slate-700">{li.description}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">{li.hsn_code}</td>
                    <td className="px-3 py-2 text-center">{li.qty}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{li.unit}</td>
                    <td className="px-3 py-2 text-right">₹{parseFloat(li.rate||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-medium">₹{li.amount.toLocaleString('en-IN')}</td>
                  </tr>
                )) : invoice?.line_items?.map((li, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-500">{i+1}</td>
                    <td className="px-3 py-2 text-slate-700">Item #{li.item_id}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">—</td>
                    <td className="px-3 py-2 text-center">{li.quantity}</td>
                    <td className="px-3 py-2 text-center text-slate-500">NOS</td>
                    <td className="px-3 py-2 text-right">₹{parseFloat(li.unit_price).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-medium">₹{(parseFloat(li.quantity)*parseFloat(li.unit_price)).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals + Bank details */}
            <div className="grid grid-cols-2 gap-4">
              {/* Bank details */}
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Bank Details</p>
                <div className="text-sm space-y-1">
                  <p><span className="text-slate-500">Bank:</span> <span className="font-medium text-slate-700">{company.bank_name}</span></p>
                  <p><span className="text-slate-500">A/C No:</span> <span className="font-medium text-slate-700">{company.account_no}</span></p>
                  <p><span className="text-slate-500">IFSC:</span> <span className="font-medium text-slate-700">{company.ifsc}</span></p>
                  <p><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-700">{company.branch}</span></p>
                </div>
              </div>

              {/* Tax summary */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  {manualMode ? (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Basic Amount:</span><span className="font-medium">₹{manualSubtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</span></div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{manualInvoice.is_interstate ? `IGST @${manualInvoice.tax_rate}%:` : `CGST+SGST @${manualInvoice.tax_rate}%:`}</span>
                        <span className="font-medium">₹{manualTax.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                        <span>Total:</span>
                        <span className="text-teal-600">₹{manualTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Basic Amount:</span><span className="font-medium">₹{Number(invoice?.subtotal||0).toLocaleString('en-IN')}</span></div>
                      {Number(invoice?.igst||0) > 0 && <div className="flex justify-between"><span className="text-slate-500">IGST:</span><span className="font-medium">₹{Number(invoice?.igst||0).toLocaleString('en-IN')}</span></div>}
                      {Number(invoice?.cgst||0) > 0 && <><div className="flex justify-between"><span className="text-slate-500">CGST:</span><span className="font-medium">₹{Number(invoice?.cgst||0).toLocaleString('en-IN')}</span></div><div className="flex justify-between"><span className="text-slate-500">SGST:</span><span className="font-medium">₹{Number(invoice?.sgst||0).toLocaleString('en-IN')}</span></div></>}
                      <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                        <span>Total:</span>
                        <span className="text-teal-600">₹{Number(invoice?.total||0).toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Terms + Signature */}
            <div className="grid grid-cols-2 gap-4 mt-4 border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600">Terms & Conditions:</p>
                <p>1) Goods once sold will not be taken back.</p>
                <p>2) Our responsibility ceases once goods are delivered.</p>
                <p>3) 18% interest charged if payment not made within 30 days.</p>
                <p>4) Subject to local jurisdiction.</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">For, {company.name}</p>
                <div className="h-12 border-b border-slate-300 mt-4 mb-2"></div>
                <p className="text-xs text-slate-500">(Authorised Signatory)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}