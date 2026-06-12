import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Layout from './components/Layout'
import Items from './pages/master/Items'
import Vendors from './pages/master/Vendors'
import Customers from './pages/master/Customers'
import PurchaseOrders from './pages/purchase/PurchaseOrders'
import Workers from './pages/workers/Workers'
import ProductionOrders from './pages/production/ProductionOrders'
import SalesInvoices from './pages/sales/SalesInvoices'
import GSTReturns from './pages/gst/GSTReturns'
import Reports from './pages/accounting/Reports'
import InvoicePrint from './pages/sales/InvoicePrint'
import MobileScanner from './pages/production/MobileScanner'
import WIPDashboard from './pages/production/WIPDashboard'
import SetupCredentials from './pages/SetupCredentials'
import InStore from "./pages/production/InStore";  
import UserManagement from './pages/UserManagement'
import IssueItems from "./pages/workers/IssueItems";
import PayablesSummary from './pages/payments/PayablesSummary'
import ReceivablesSummary from './pages/payments/ReceivablesSummary'
import PaymentLedger from './pages/payments/PaymentLedger'
import PaymentsDashboard from './pages/payments/PaymentsDashboard'
import DataImport from "./pages/master/DataImport";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* /setup is outside Layout — full screen, no sidebar */}
      <Route
        path="/setup"
        element={
          <PrivateRoute>
            <SetupCredentials />
          </PrivateRoute>
        }
      />

      {/* All app routes inside sidebar Layout */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="items" element={<Items />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="customers" element={<Customers />} />
        <Route path="purchase" element={<PurchaseOrders />} />
        <Route path="workers" element={<Workers />} />
        <Route path="production" element={<ProductionOrders />} />
        <Route path="sales" element={<SalesInvoices />} />
        <Route path="gst" element={<GSTReturns />} />
        <Route path="reports" element={<Reports />} />
        <Route path="invoice-print" element={<InvoicePrint />} />
        <Route path="scan" element={<MobileScanner />} />
        <Route path="wip" element={<WIPDashboard />} />
        <Route path="admin" element={<UserManagement />} />
        <Route path="in-store" element={<InStore />} />
        <Route path="issue-items" element={<IssueItems />} />
        <Route path="payments" element={<PaymentsDashboard />} />
        <Route path="payments/payables" element={<PayablesSummary />} />
        <Route path="payments/receivables" element={<ReceivablesSummary />} />
        <Route path="payments/ledger" element={<PaymentLedger />} />
        <Route path="/data-import" element={<DataImport />} />
        
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}