import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex bg-slate-100 min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}