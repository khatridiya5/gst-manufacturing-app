import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import api from "../../api/client"

const STEPS = { WORKER: 1, PART: 2, ACTION: 3, SUCCESS: 4 }

function QRScanner({ onScan, hint, id }) {
  const startedRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(id)
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decoded) => {
        startedRef.current = false
        scanner.stop().then(() => onScan(decoded)).catch(console.error)
      },
      () => {}
    ).then(() => {
      startedRef.current = true
    }).catch(console.error)

    return () => {
      if (startedRef.current) {
        startedRef.current = false
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
      <div id={id} className="w-full h-full" />
      {["tl","tr","bl","br"].map(c => (
        <div key={c} className={`absolute w-8 h-8 border-[#3dffa0] border-solid border-0
          ${c==="tl" ? "top-4 left-4 border-t-2 border-l-2 rounded-tl" : ""}
          ${c==="tr" ? "top-4 right-4 border-t-2 border-r-2 rounded-tr" : ""}
          ${c==="bl" ? "bottom-4 left-4 border-b-2 border-l-2 rounded-bl" : ""}
          ${c==="br" ? "bottom-4 right-4 border-b-2 border-r-2 rounded-br" : ""}
        `} />
      ))}
      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/50">{hint}</p>
    </div>
  )
}

export default function MobileScanner() {
  const [step, setStep] = useState(STEPS.WORKER)
  const [workerQR, setWorkerQR] = useState(null)
  const [workerName, setWorkerName] = useState(null)
  const [partQR, setPartQR] = useState(null)
  const [scanType, setScanType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scannedParts, setScannedParts] = useState([]) // track all parts scanned this session

  const handleWorkerScan = async (qrData) => {
    setError(null)
    try {
      const res = await api.post("/production/wip/verify-worker", { qr_code: qrData })
      setWorkerQR(qrData)
      setWorkerName(res.data.name)
      setStep(STEPS.PART)
    } catch {
      setError("Worker QR not recognised. Try again.")
    }
  }

  const handlePartScan = (qrData) => {
    setError(null)
    setPartQR(qrData)
    setScanType(null)
    setStep(STEPS.ACTION)
  }

  const handleSubmit = async () => {
    console.log("Submitting:", { worker_qr: workerQR, part_qr: partQR, scan_type: scanType })
    setLoading(true)
    setError(null)
    try {
      await api.post("/production/wip/scan", {
        worker_qr: workerQR,
        part_qr: partQR,
        scan_type: scanType,
      })
      setScannedParts(prev => [...prev, { qr: partQR, type: scanType }])
      setStep(STEPS.SUCCESS)
    } catch {
      setError("Failed to submit scan. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const scanMoreParts = () => {
    // keep worker, go back to part scan
    setPartQR(null)
    setScanType(null)
    setError(null)
    setStep(STEPS.PART)
  }

  const resetAll = () => {
    setStep(STEPS.WORKER)
    setWorkerQR(null)
    setWorkerName(null)
    setPartQR(null)
    setScanType(null)
    setError(null)
    setScannedParts([])
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center">
      <div className="w-full max-w-sm min-h-screen flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-6 pt-8 pb-2">
          <span className="text-[#3dffa0] text-xs font-semibold tracking-widest uppercase">WIP Scanner</span>
          <span className="text-[#444] text-xs font-mono">Step {Math.min(step, 3)} / 3</span>
        </div>

        {/* progress */}
        <div className="flex gap-1.5 px-6 mb-6">
          {[1,2,3].map(i => (
            <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${step >= i ? "bg-[#3dffa0]" : "bg-[#222]"}`} />
          ))}
        </div>

        <div className="flex-1 px-6">

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* step 1 — worker badge */}
          {step === STEPS.WORKER && (
            <>
              <h1 className="text-2xl font-semibold leading-tight mb-1">Scan your<br/>worker badge</h1>
              <p className="text-[#555] text-sm mb-6">Point camera at your QR badge</p>
              <QRScanner id="qr-worker" onScan={handleWorkerScan} hint="Align worker QR within frame" />
            </>
          )}
          <button
      onClick={() => handleWorkerScan("WORKER-QR-001")}  // replace with a real worker QR from your DB
      className="w-full py-4 rounded-2xl bg-[#3dffa0] text-black font-bold text-base mt-4"
    >
      Test: Use Worker Badge
    </button>
  


          {/* step 2 — part QR */}
          {step === STEPS.PART && (
  <>
    <div className="inline-flex items-center gap-2 bg-[#111] border border-[#222] rounded-xl px-3 py-2 mb-5">
      <span className="w-2 h-2 rounded-full bg-[#3dffa0]" />
      <span className="text-[#666] text-xs">Worker:</span>
      <span className="text-white text-xs font-semibold">{workerName}</span>
    </div>

    {scannedParts.length > 0 && (
      <div className="mb-4 bg-[#111] border border-[#222] rounded-xl p-3">
        <p className="text-[#555] text-xs mb-2">Scanned this session:</p>
        {scannedParts.map((p, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <span className="text-white text-xs font-mono">{p.qr}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${p.type === "start" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{p.type}</span>
          </div>
        ))}
      </div>
    )}

    <h1 className="text-2xl font-semibold leading-tight mb-1">Scan the<br/>part QR code</h1>
    <p className="text-[#555] text-sm mb-4">Point camera at the part label</p>
    <QRScanner id="qr-part" onScan={handlePartScan} hint="Align part QR within frame" />

    {/* manual fallback for testing */}
    <p className="text-[#444] text-xs text-center mt-4 mb-2">or enter manually</p>
    <div className="flex gap-2">
      <input
        id="manual-part"
        className="flex-1 bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none"
        placeholder="e.g. RM-RM001-PO-1-0001-0001"
      />

      {/* test button goes HERE, inside Step 2 */}
        <button
             onClick={() => handlePartScan("RM-RM001-PO-1-0001-0001")}
             className="w-full py-4 rounded-2xl bg-[#3dffa0] text-black font-bold text-base mt-3"
        >
            Test: Use Part RM-RM001-PO-1-0001-0001
        </button>
      <button
        onClick={() => {
          const val = document.getElementById("manual-part").value.trim()
          if (val) handlePartScan(val)
        }}
        className="bg-[#3dffa0] text-black font-semibold rounded-xl px-4 py-2 text-sm"
      >
        Use
      </button>
    </div>
  </>
)}

    <button
        onClick={() => handlePartScan("RM-RM001-PO-1-0001-0001")}
        className="w-full py-4 rounded-2xl bg-[#3dffa0] text-black font-bold text-base mb-4"
    >
        Test: Use Part RM-RM001-PO-1-0001-0001
    </button>

          {/* step 3 — action */}
          {step === STEPS.ACTION && (
            <>
              <div className="inline-flex items-center gap-2 bg-[#111] border border-[#222] rounded-xl px-3 py-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-[#3dffa0]" />
                <span className="text-white text-xs font-semibold">{workerName}</span>
                <span className="text-[#666] text-xs">· {partQR}</span>
              </div>
              <h1 className="text-2xl font-semibold leading-tight mb-1">What are<br/>you doing?</h1>
              <p className="text-[#555] text-sm mb-6">Select the action type</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setScanType("start")}
                  className={`py-5 rounded-2xl border text-base font-semibold transition-all ${
                    scanType === "start" ? "bg-[#3dffa0] text-black border-[#3dffa0]" : "bg-[#111] text-white border-[#222]"
                  }`}
                >▶ Start</button>
                <button
                  onClick={() => setScanType("end")}
                  className={`py-5 rounded-2xl border text-base font-semibold transition-all ${
                    scanType === "end" ? "bg-red-500 text-white border-red-500" : "bg-[#111] text-white border-[#222]"
                  }`}
                >■ End</button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!scanType || loading}
                className="w-full py-4 rounded-2xl bg-[#3dffa0] text-black font-bold text-base disabled:bg-[#1a1a1a] disabled:text-[#444] transition-all"
              >
                {loading ? "Submitting..." : "Submit scan"}
              </button>
            </>
          )}

          {/* success */}
          {step === STEPS.SUCCESS && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-full bg-[#0d2b1a] border-2 border-[#3dffa0] flex items-center justify-center text-3xl mb-6">✓</div>
              <h2 className="text-2xl font-semibold mb-2">Scan recorded!</h2>
              <p className="text-[#555] text-sm mb-2">{scanType} · {partQR}</p>
              <p className="text-[#333] text-xs mb-8">{scannedParts.length} part{scannedParts.length !== 1 ? "s" : ""} scanned this session</p>

              <button
                onClick={scanMoreParts}
                className="w-full py-4 rounded-2xl bg-[#3dffa0] text-black font-bold text-base mb-3"
              >
                Scan more parts
              </button>
              <button
                onClick={resetAll}
                className="bg-[#111] border border-[#222] text-[#aaa] rounded-xl px-8 py-3 text-sm"
              >
                Done · change worker
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}