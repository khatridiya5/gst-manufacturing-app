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
  pan: '',
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
  const W = 210, margin = 12, TW = W - margin * 2
  const x0 = margin
  let y = 15

  const isManual = manualMode
  const invNum  = isManual ? manualInvoice.invoice_number : invoice?.invoice_number
  const invDate = isManual ? manualInvoice.invoice_date   : invoice?.invoice_date
  const custName = isManual ? manualInvoice.customer_name  : invoice?.customer
  const custAddr = isManual ? manualInvoice.customer_address : ''
  const custGSTIN = isManual ? manualInvoice.customer_gstin : ''
  const custState = isManual ? manualInvoice.customer_state : company.state
  const isInter  = isManual ? manualInvoice.is_interstate  : invoice?.is_interstate
  const taxRate  = isManual ? manualInvoice.tax_rate : 18

  // helpers
  const rh = 5.2
  const drawRect = (x, y, w, h) => doc.rect(x, y, w, h)
  const cell = (x, y, w, h, txt = '', opts = {}) => {
    const { bold = false, size = 7, align = 'L', px = 1.5, py = 1.2 } = opts
    doc.setDrawColor(0)
    doc.rect(x, y, w, h)
    if (!txt) return
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(0)
    const ty = y + py + size * 0.352
    if (align === 'C') doc.text(String(txt), x + w / 2, ty, { align: 'center' })
    else if (align === 'R') doc.text(String(txt), x + w - px, ty, { align: 'right' })
    else doc.text(String(txt), x + px, ty)
  }

  // ── TITLE ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Tax Invoice', W / 2, y, { align: 'center' })
  y += 5

  // column layout
  const lw = TW * 0.52, rw = TW - lw, rx = x0 + lw
  const c1 = rw * 0.37, c2 = rw * 0.27, c3 = rw - c1 - c2

  // ── COMPANY + META ROWS ────────────────────────────────────
  const companyRows = [
    [company.name, true, 7.5],
    ['', false, 6.5],
    [company.address.split(',')[0] || '', false, 7],
    [company.address.split(',').slice(1).join(',').trim() || '', false, 7],
    ['', false, 7],
    ['', false, 7],
    [`GSTIN/UIN: ${company.gstin}`, false, 7],
    [`State Name :  ${company.state}, Code : ${company.state_code}`, false, 7],
    ['CIN: ........', false, 7],
  ]
  const metaRows = [
    [['Invoice No.', 'e-Way Bill No.', 'Dated']],
    [[invNum || '', '', invDate || '']],
    [['Delivery Note', 'Mode/Terms of Payment', '']],
    [['', '', '']],
    [['Reference No. & Date.', 'Other References', '']],
    [['', '', '']],
    [["Buyer's Order No.", 'Dated', '']],
    [['', '', '']],
    [['Dispatch Doc No.', 'Delivery Note Date', '']],
  ]

  companyRows.forEach(([txt, bold, sz], i) => {
    cell(x0, y, lw, rh, txt, { bold, size: sz })
    const [labels] = metaRows[i]
    if (labels.length === 3) {
      cell(rx,       y, c1, rh, labels[0], { size: 7 })
      cell(rx+c1,    y, c2, rh, labels[1], { size: 7 })
      cell(rx+c1+c2, y, c3, rh, labels[2], { size: 7 })
    }
    y += rh
  })

  // ── CONSIGNEE ─────────────────────────────────────────────
  const dw = rw * 0.5
  const conRows = [
    ['Consignee (Ship to)', false],
    [custName || '', true],
    [custAddr || '', false],
    ['', false],
    [custState ? `Ahmedabad ${custState}` : '', false],
    ['GSTIN/UIN:', false],
    [`State Name :        ${custState || 'Gujarat'}, Code : ${company.state_code}`, false],
  ]
  const conRight = [
    ['Dispatched through', 'Destination'],
    ['', ''],
    ['Bill of Lading/LR-RR No.', 'Motor Vehicle No.'],
    ['', ''],
    ['Terms of Delivery', ''],
    ['', ''],
    ['', ''],
  ]
  conRows.forEach(([txt, bold], i) => {
    cell(x0, y, lw, rh, txt, { bold, size: 7 })
    if (i < 2) {
      cell(rx,    y, dw, rh, conRight[i][0], { size: 7 })
      cell(rx+dw, y, rw-dw, rh, conRight[i][1], { size: 7 })
    } else if (i === 2) {
      cell(rx,    y, dw, rh, conRight[i][0], { size: 7 })
      cell(rx+dw, y, rw-dw, rh, conRight[i][1], { size: 7 })
    } else {
      cell(rx, y, rw, rh, i === 4 ? 'Terms of Delivery' : '', { size: 7 })
    }
    y += rh
  })

  // ── BUYER ─────────────────────────────────────────────────
  const buyerRows = [
    ['Buyer (Bill to)', false],
    [custName || '', true],
    [custAddr || '', false],
    ['', false],
    ['', false],
    ['GSTIN/UIN:', false],
    [`State Name :        ${custState || 'Gujarat'}, Code : ${company.state_code}`, false],
  ]
  buyerRows.forEach(([txt, bold]) => {
    cell(x0, y, TW, rh, txt, { bold, size: 7 })
    y += rh
  })

  // ── ITEMS TABLE HEADER ─────────────────────────────────────
  const si_w=TW*0.04, desc_w=TW*0.35, hsn_w=TW*0.115,
        qty_w=TW*0.09, rate_w=TW*0.105, per_w=TW*0.07,
        disc_w=TW*0.085
  const amt_w = TW - si_w - desc_w - hsn_w - qty_w - rate_w - per_w - disc_w
  const hdrH = 6.5

  let cx = x0
  cell(cx, y, si_w,   hdrH, 'Sl\nNo.', { align:'C' }); cx+=si_w
  cell(cx, y, desc_w, hdrH, 'Description of Goods', { align:'C' }); cx+=desc_w
  cell(cx, y, hsn_w,  hdrH, 'HSN/SAC', { align:'C' }); cx+=hsn_w
  cell(cx, y, qty_w,  hdrH, 'Quantity', { align:'C' }); cx+=qty_w
  cell(cx, y, rate_w, hdrH, 'Rate', { align:'C' }); cx+=rate_w
  cell(cx, y, per_w,  hdrH, 'per', { align:'C' }); cx+=per_w
  cell(cx, y, disc_w, hdrH, 'Disc. %', { align:'C' }); cx+=disc_w
  cell(cx, y, amt_w,  hdrH, 'Amount', { align:'C' })
  y += hdrH

  // ── LINE ITEMS ─────────────────────────────────────────────
  const itemH = 5.5
  let lineItems = []
  if (isManual) {
    const { lines } = calcManual()
    lineItems = lines.map((li, i) => ({
      sl: i+1,
      category: li.description,
      description: li.description,
      hsn: li.hsn_code,
      qty: li.qty,
      unit: li.unit || 'NOS',
      rate: parseFloat(li.rate||0),
      amount: li.amount,
      date: '',
    }))
  } else if (invoice?.line_items) {
    lineItems = invoice.line_items.map((li, i) => ({
      sl: i+1,
      category: `Item #${li.item_id}`,
      description: `Item #${li.item_id}`,
      hsn: '',
      qty: li.quantity,
      unit: 'NOS',
      rate: parseFloat(li.unit_price),
      amount: parseFloat(li.quantity)*parseFloat(li.unit_price),
      date: '',
    }))
  }

  lineItems.forEach(item => {
    // category row
    cx = x0
    cell(cx,y,si_w,  itemH,String(item.sl),{align:'C'}); cx+=si_w
    cell(cx,y,desc_w,itemH,item.category,{bold:true}); cx+=desc_w
    cell(cx,y,hsn_w, itemH,item.hsn||''); cx+=hsn_w
    cell(cx,y,qty_w, itemH,''); cx+=qty_w
    cell(cx,y,rate_w,itemH,''); cx+=rate_w
    cell(cx,y,per_w, itemH,''); cx+=per_w
    cell(cx,y,disc_w,itemH,''); cx+=disc_w
    cell(cx,y,amt_w, itemH,'')
    y += itemH

    // detail row
    cx = x0
    cell(cx,y,si_w,  itemH,''); cx+=si_w
    const dLabel = item.date ? `${item.description}     (${item.date})` : item.description
    cell(cx,y,desc_w,itemH,dLabel,{bold:true}); cx+=desc_w
    cell(cx,y,hsn_w, itemH,''); cx+=hsn_w
    cell(cx,y,qty_w, itemH,`${item.qty} ${item.unit}`,{bold:true,align:'C'}); cx+=qty_w
    cell(cx,y,rate_w,itemH,`${item.rate.toFixed(2)}`,{align:'R'}); cx+=rate_w
    cell(cx,y,per_w, itemH,item.unit,{align:'C'}); cx+=per_w
    cell(cx,y,disc_w,itemH,''); cx+=disc_w
    cell(cx,y,amt_w, itemH,`${item.amount.toFixed(2)}`,{bold:true,align:'R'})
    y += itemH
  })

  // blank rows
  for (let i = 0; i < 5; i++) {
    cx = x0
    ;[si_w,desc_w,hsn_w,qty_w,rate_w,per_w,disc_w,amt_w].forEach(w=>{
      cell(cx,y,w,itemH,''); cx+=w
    })
    y += itemH
  }

  // ── TAX ROWS ───────────────────────────────────────────────
  const subtotal = lineItems.reduce((s,l)=>s+l.amount,0)
  const halfRate = isInter ? 0 : taxRate/2
  const cgstAmt  = isInter ? 0 : subtotal * halfRate / 100
  const sgstAmt  = isInter ? 0 : subtotal * halfRate / 100
  const igstAmt  = isInter ? subtotal * taxRate / 100 : 0
  const totalAmt = subtotal + cgstAmt + sgstAmt + igstAmt
  const labelW   = si_w+desc_w+hsn_w+qty_w+rate_w+per_w+disc_w
  const subH = 5

  // subtotal line
  cx=x0; cell(cx,y,labelW,subH,''); cx+=labelW
  cell(cx,y,amt_w,subH,subtotal.toFixed(2),{align:'R'}); y+=subH

  if (isInter) {
    cx=x0
    cell(cx,y,labelW,subH,`OUTPUT IGST @ ${taxRate}%`,{bold:true,align:'R'}); cx+=labelW
    cell(cx,y,amt_w,subH,igstAmt.toFixed(2),{bold:true,align:'R'}); y+=subH
  } else {
    // CGST
    const cgstLW = labelW - qty_w - rate_w - per_w
    cx=x0
    cell(cx,y,cgstLW,subH,`OUTPUT CGST @ ${halfRate}%`,{bold:true,align:'R'}); cx+=cgstLW
    cell(cx,y,qty_w, subH,''); cx+=qty_w
    cell(cx,y,rate_w,subH,String(halfRate),{align:'R'}); cx+=rate_w
    cell(cx,y,per_w, subH,'%',{align:'C'}); cx+=per_w
    cell(cx,y,disc_w,subH,''); cx+=disc_w
    cell(cx,y,amt_w, subH,cgstAmt.toFixed(2),{bold:true,align:'R'}); y+=subH
    // SGST
    cx=x0
    cell(cx,y,cgstLW,subH,`OUTPUT SGST @ ${halfRate}%`,{bold:true,align:'R'}); cx+=cgstLW
    cell(cx,y,qty_w, subH,''); cx+=qty_w
    cell(cx,y,rate_w,subH,String(halfRate),{align:'R'}); cx+=rate_w
    cell(cx,y,per_w, subH,'%',{align:'C'}); cx+=per_w
    cell(cx,y,disc_w,subH,''); cx+=disc_w
    cell(cx,y,amt_w, subH,sgstAmt.toFixed(2),{bold:true,align:'R'}); y+=subH
  }

  // total row
  const totalQty = lineItems.reduce((s,l)=>s+parseFloat(l.qty||0),0)
  const totH = 5.5
  const cgstLW2 = labelW - qty_w - rate_w - per_w
  cx=x0
  cell(cx,y,cgstLW2,totH,'Total',{align:'R'}); cx+=cgstLW2
  cell(cx,y,qty_w,totH,`${totalQty} NOS`,{bold:true,align:'C'}); cx+=qty_w
  cell(cx,y,rate_w,totH,''); cx+=rate_w
  cell(cx,y,per_w, totH,''); cx+=per_w
  cell(cx,y,disc_w,totH,''); cx+=disc_w
  cell(cx,y,amt_w, totH,`\u20b9 ${totalAmt.toFixed(2)}`,{bold:true,align:'R',size:8})
  y+=totH

  // ── AMOUNT IN WORDS ────────────────────────────────────────
  const awH = 4.5
  cell(x0, y, TW*0.6, awH, 'Amount Chargeable (in words)', {size:7})
  cell(x0+TW*0.6, y, TW*0.4, awH, 'E. & O.E', {size:7,align:'R'})
  y+=awH
  const numToWords = (n) => {
    const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
      'Seventeen','Eighteen','Nineteen']
    const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    if(n===0) return 'Zero'
    const t = Math.round(n)
    if(t<20) return ones[t]
    if(t<100) return tens[Math.floor(t/10)]+(t%10?' '+ones[t%10]:'')
    if(t<1000) return ones[Math.floor(t/100)]+' Hundred'+(t%100?' '+numToWords(t%100):'')
    if(t<100000) return numToWords(Math.floor(t/1000))+' Thousand'+(t%1000?' '+numToWords(t%1000):'')
    if(t<10000000) return numToWords(Math.floor(t/100000))+' Lakh'+(t%100000?' '+numToWords(t%100000):'')
    return numToWords(Math.floor(t/10000000))+' Crore'+(t%10000000?' '+numToWords(t%10000000):'')
  }
  const amtWords = numToWords(Math.round(totalAmt)) + ' Rupees Only.'
  cell(x0, y, TW, awH, '  '+amtWords, {bold:true,size:7})
  y+=awH

  // ── HSN TAX SUMMARY ────────────────────────────────────────
  const th = 4.5
  const hsnC=TW*0.20,taxC=TW*0.15,rateC=TW*0.10,amtC=TW*0.10,totTax=TW-(hsnC+taxC+rateC+amtC)*2
  // header row 1
  cx=x0
  cell(cx,y,hsnC,th,'HSN/SAC',{align:'C'}); cx+=hsnC
  cell(cx,y,taxC,th,'Taxable',{align:'C'}); cx+=taxC
  cell(cx,y,rateC+amtC,th,'CGST',{align:'C'}); cx+=rateC+amtC
  cell(cx,y,rateC+amtC,th,isInter?'IGST':'SGST/UTGST',{align:'C'}); cx+=rateC+amtC
  cell(cx,y,totTax,th,'Total',{align:'C'}); y+=th
  // header row 2
  cx=x0
  cell(cx,y,hsnC,th,'',{}); cx+=hsnC
  cell(cx,y,taxC,th,'Value',{align:'C'}); cx+=taxC
  cell(cx,y,rateC,th,'Rate',{align:'C'}); cx+=rateC
  cell(cx,y,amtC,th,'Amount',{align:'C'}); cx+=amtC
  cell(cx,y,rateC,th,'Rate',{align:'C'}); cx+=rateC
  cell(cx,y,amtC,th,'Amount',{align:'C'}); cx+=amtC
  cell(cx,y,totTax,th,'Tax Amount',{align:'C'}); y+=th

  // data rows
  const uniqueHSN = {}
  lineItems.forEach(li=>{
    const k = li.hsn||'—'
    if(!uniqueHSN[k]) uniqueHSN[k]={taxable:0}
    uniqueHSN[k].taxable += li.amount
  })
  Object.entries(uniqueHSN).forEach(([hsn,{taxable}])=>{
    const cAmt = isInter ? 0 : taxable*halfRate/100
    const sAmt = isInter ? 0 : taxable*halfRate/100
    const iAmt = isInter ? taxable*taxRate/100 : 0
    const totT = cAmt+sAmt+iAmt
    cx=x0
    cell(cx,y,hsnC,th,hsn,{}); cx+=hsnC
    cell(cx,y,taxC,th,taxable.toFixed(2),{align:'R'}); cx+=taxC
    cell(cx,y,rateC,th,isInter?`${taxRate}%`:`${halfRate}%`,{align:'C'}); cx+=rateC
    cell(cx,y,amtC,th,(isInter?iAmt:cAmt).toFixed(2),{align:'R'}); cx+=amtC
    cell(cx,y,rateC,th,isInter?`${taxRate}%`:`${halfRate}%`,{align:'C'}); cx+=rateC
    cell(cx,y,amtC,th,(isInter?iAmt:sAmt).toFixed(2),{align:'R'}); cx+=amtC
    cell(cx,y,totTax,th,totT.toFixed(2),{align:'R'}); y+=th
  })
  // total row
  const totalTax = cgstAmt+sgstAmt+igstAmt
  cx=x0
  cell(cx,y,hsnC,th,'Total',{align:'R'}); cx+=hsnC
  cell(cx,y,taxC,th,subtotal.toFixed(2),{align:'R'}); cx+=taxC
  cell(cx,y,rateC,th,'',{}); cx+=rateC
  cell(cx,y,amtC,th,(isInter?igstAmt:cgstAmt).toFixed(2),{align:'R'}); cx+=amtC
  cell(cx,y,rateC,th,'',{}); cx+=rateC
  cell(cx,y,amtC,th,(isInter?igstAmt:sgstAmt).toFixed(2),{align:'R'}); cx+=amtC
  cell(cx,y,totTax,th,totalTax.toFixed(2),{bold:true,align:'R'}); y+=th

  // ── FOOTER ─────────────────────────────────────────────────
  const fh=4.5, hw=TW/2
  // tax in words
  const taxWords = numToWords(Math.round(totalTax)) + ' Rupees Only'
  cell(x0,y,hw*0.35,fh,'Tax Amount (in words) :',{size:7})
  cell(x0+hw*0.35,y,TW-hw*0.35,fh,'INR '+taxWords,{size:7}); y+=fh
  // PAN + for company
  cell(x0,y,hw*0.35,fh,"Company's PAN :",{size:7})
  cell(x0+hw*0.35,y,hw*0.65,fh,company.pan||'',{bold:true,size:7})
  cell(x0+hw,y,TW-hw,fh,`for ${company.name}`,{bold:true,align:'C',size:7}); y+=fh
  // declaration
  cell(x0,y,hw,fh,'Declaration',{size:7})
  cell(x0+hw,y,TW-hw,fh,'',{}); y+=fh
  cell(x0,y,hw,8,'We declare that this invoice shows the actual price of the',{size:6.5})
  cell(x0+hw,y,TW-hw,8,'Authorised Signatory',{align:'C',size:7}); y+=8

  // bottom note
  doc.setFont('helvetica','normal')
  doc.setFontSize(7)
  doc.text('This is a Computer Generated Invoice', W/2, y+2, {align:'center'})

  doc.save(`${invNum||'invoice'}.pdf`)
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
                { label: 'Company PAN', key: 'pan' },
        

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