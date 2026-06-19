import { NavLink, useNavigate } from 'react-router-dom'

const allLinks = [
  { to: '/',             label: 'Dashboard',     icon: '📊', end: true, roles: ['admin'] },
  { to: '/purchase',     label: 'Purchase',      icon: '📦', roles: ['admin', 'purchase'] },
  { to: '/production',   label: 'Production',    icon: '🏭', roles: ['admin', 'production'] },
  { to: '/sales',        label: 'Sales',         icon: '🧾', roles: ['admin', 'sales'] },
  { to: '/gst',          label: 'GST Returns',   icon: '📋', roles: ['admin'] },
  { to: '/reports',      label: 'Reports',       icon: '📈', roles: ['admin'] },
  { to: '/vendors',      label: 'Vendors',       icon: '🏪', roles: ['admin', 'purchase'] },
  { to: '/customers',    label: 'Customers',     icon: '👥', roles: ['admin', 'sales'] },
  { to: '/workers',      label: 'Workers',       icon: '👷', roles: ['admin', 'store_manager'] },
  { to: '/invoice-print',label: 'Invoice Print', icon: '🖨️', roles: ['admin', 'sales'] },
  { to: '/wip',          label: 'WIP Tracking',  icon: '📡', roles: ['admin', 'production'] },
  { to: '/in-store',     label: 'In-Store',      icon: '🏪', roles: ['admin', 'store_manager'] },
  { to: '/issue-items',  label: 'Issue Items',   icon: '📤', roles: ['admin', 'store_manager'] },
  { to: '/data-import',  label: 'Data Import',   icon: '📥', roles: ['admin'] },
  { to: '/admin',        label: 'User Management',icon: '⚙️', roles: ['admin'] },
  
]

// What each role sees after login
// admin        → everything
// purchase     → Purchase, Vendors
// sales        → Sales, Customers, Invoice Print
// production   → Production, WIP Tracking
// store_manager→ Workers, In-Store, Issue Items

export default function Sidebar() {
  const navigate = useNavigate()
  const section = sessionStorage.getItem('active_section') || 'admin'  // ✅
const role = localStorage.getItem(`role_${section}`) || 'admin'

const handleLogout = () => {
  const section = sessionStorage.getItem('active_section') || 'admin'  // ✅
  localStorage.removeItem(`token_${section}`)
  localStorage.removeItem(`role_${section}`)
  sessionStorage.removeItem('active_section')  // ✅
  navigate('/login')
}

  const roleLabel = {
    admin: 'Admin',
    purchase: 'Purchase',
    sales: 'Sales',
    production: 'Production',
    store_manager: 'Store Manager',
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

      {/* Role badge */}
      <div className="px-4 py-2 border-b border-slate-700">
        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 font-medium capitalize">
          {roleLabel[role] || role}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {allLinks.filter(link => link.roles.includes(role)).map((link) => (
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