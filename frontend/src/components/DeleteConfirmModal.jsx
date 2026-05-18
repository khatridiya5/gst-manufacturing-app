// src/components/DeleteConfirmModal.jsx
import { useState } from 'react'

export default function DeleteConfirmModal({ itemName, onConfirm, onCancel }) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!otp) { setError('Enter OTP'); return }
    onConfirm(otp)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Confirm Delete</h2>
        <p className="text-sm text-slate-500 mb-4">
          Enter OTP to delete <span className="font-medium text-red-500">{itemName}</span>
        </p>
        <input
          type="password"
          maxLength={6}
          value={otp}
          onChange={(e) => { setOtp(e.target.value); setError('') }}
          placeholder="Enter OTP"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-xl tracking-widest mb-2 focus:outline-none focus:border-teal-500"
        />
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button onClick={onCancel} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={handleConfirm} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}