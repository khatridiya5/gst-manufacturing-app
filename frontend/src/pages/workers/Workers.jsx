import { useEffect, useState } from 'react'
import api from '../../api/client'
import DeleteConfirmModal from '../../components/DeleteConfirmModal'

export default function Workers() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [phone, setPhone] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const departments = ['Assembly', 'Welding', 'Cutting', 'Quality Check', 'Packaging', 'Dispatch']

  const fetchWorkers = async () => {
    try {
      const res = await axios.get("/api/workers");
      setWorkers(Array.isArray(res.data) ? res.data : res.data.workers || res.data.data || []);
    } catch {
      setWorkers([]);
    }
  };

  useEffect(() => { fetchWorkers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/workers/', { name, department, phone })
      setShowForm(false)
      setName('')
      setDepartment('')
      setPhone('')
      fetchWorkers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error creating worker')
    }
  }

  const handleViewQR = async (workerId) => {
    try {
      const res = await api.get(`/workers/${workerId}/qr`)
      setSelectedWorker(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (otp) => {
  try {
    await api.delete(`/workers/${deleteTarget.id}?otp=${otp}`)
    setDeleteTarget(null)
    fetchWorkers()
  } catch (err) {
    alert(err.response?.data?.detail || 'Error deleting worker')
  }
}

  const deptColors = {
    'Assembly': 'bg-teal-50 text-teal-700',
    'Welding': 'bg-orange-50 text-orange-700',
    'Cutting': 'bg-blue-50 text-blue-700',
    'Quality Check': 'bg-green-50 text-green-700',
    'Packaging': 'bg-violet-50 text-violet-700',
    'Dispatch': 'bg-amber-50 text-amber-700',
  }

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workers</h1>
          <p className="text-slate-500 text-sm mt-1">{workers.length} active workers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Worker
        </button>
      </div>

      {/* Create Worker Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">Add New Worker</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select department...</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
              >
                Add Worker
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

      {/* Workers Grid */}
      <div className="grid grid-cols-3 gap-4">
        {workers.length === 0 && (
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            No workers yet. Add your first worker.
          </div>
        )}
        {workers.map((worker) => (
          <div key={worker.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-slate-800 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-800">{worker.name}</p>
                <p className="text-xs text-slate-400 font-mono">{worker.worker_code}</p>
              </div>
            </div>

            {/* Department */}
            {worker.department && (
              <div className="mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  deptColors[worker.department] || 'bg-slate-100 text-slate-600'
                }`}>
                  {worker.department}
                </span>
              </div>
            )}

            {/* Phone */}
            {worker.phone && (
              <p className="text-sm text-slate-500 mb-4">📞 {worker.phone}</p>
            )}

            {/* QR code preview */}
            {worker.qr_code_data && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs font-mono text-slate-500 break-all">{worker.qr_code_data}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleViewQR(worker.id)}
                className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-medium transition-colors"
              >
                🖨️ Print QR Card
              </button>
              <button
                onClick={() => setDeleteTarget({ id: worker.id, name: worker.name })}
                className="py-2 px-3 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Card Print Modal */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">Worker QR Card</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium"
                >
                  🖨️ Print
                </button>
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable QR Card */}
            <div className="p-6 text-center print:p-4">
              <div className="border-2 border-slate-200 rounded-xl p-5 inline-block w-full">
                {/* Company name */}
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Auto Parts Pvt Ltd
                </p>

                {/* QR Image */}
                {selectedWorker.qr_code_image && (
                  <img
                    src={`data:image/png;base64,${selectedWorker.qr_code_image}`}
                    alt="Worker QR Code"
                    className="w-48 h-48 mx-auto mb-3"
                  />
                )}
                

                {/* Worker details */}
                <p className="text-xl font-bold text-slate-800 mb-1">{selectedWorker.name}</p>
                <p className="text-sm font-mono text-slate-500 mb-1">{selectedWorker.worker_code}</p>
                {selectedWorker.department && (
                  <p className="text-sm text-slate-500">{selectedWorker.department}</p>
                )}

                {/* QR data string */}
                <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs font-mono text-slate-400 break-all">
                    {selectedWorker.qr_code_data}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          itemName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}