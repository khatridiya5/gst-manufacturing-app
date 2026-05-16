import { NavLink, useNavigate } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/purchase', label: 'Purchase', icon: '📦' },
  { to: '/production', label: 'Production', icon: '🏭' },
  { to: '/sales', label: 'Sales', icon: '🧾' },
  { to: '/gst', label: 'GST Returns', icon: '📋' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/items', label: 'Items', icon: '🔩' },
  { to: '/vendors', label: 'Vendors', icon: '🏪' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/workers', label: 'Workers', icon: '👷' },
  { to: '/invoice-print', label: 'Invoice Print', icon: '🖨️' },
  { to: '/wip', label: 'WIP Tracking', icon: '📡' },
  
]

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  return (
    <div className="w-60 bg-slate-900 h-screen flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">GST</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Manufacturing</p>
            <p className="text-slate-400 text-xs">Auto Parts</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <span>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </div>
  )
}


