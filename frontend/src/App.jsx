import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { AdminRoute, ProtectedRoute } from './routes/ProtectedRoute'
import CashPage from './pages/CashPage'
import DebtsPage from './pages/DebtsPage'
import HistoryPage from './pages/HistoryPage'
import GuestPage from './pages/GuestPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductFormPage from './pages/ProductFormPage'
import ProductsPage from './pages/ProductsPage'
import ManagementPage from './pages/ManagementPage'
import ShoppingListPage from './pages/ShoppingListPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/guest" element={<GuestPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<ProductsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="debts" element={<DebtsPage />} />
            <Route path="shopping-list" element={<ShoppingListPage />} />
            <Route path="cash" element={<CashPage />} />
            <Route path="movements" element={<HistoryPage />} />
            <Route element={<AdminRoute />}>
              <Route path="admin/users" element={<UsersPage />} />
              <Route path="admin/management" element={<ManagementPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
