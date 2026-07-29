import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { AdminRoute, ProtectedRoute } from './routes/ProtectedRoute'
import CashPage from './pages/CashPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductFormPage from './pages/ProductFormPage'
import ProductsPage from './pages/ProductsPage'
import PurchaseFormPage from './pages/PurchaseFormPage'
import PurchasesPage from './pages/PurchasesPage'
import QuickWithdrawalPage from './pages/QuickWithdrawalPage'
import ShoppingListPage from './pages/ShoppingListPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="withdraw" element={<QuickWithdrawalPage />} />
            <Route path="shopping-list" element={<ShoppingListPage />} />
            <Route path="cash" element={<CashPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route element={<AdminRoute />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="purchases" element={<PurchasesPage />} />
              <Route path="purchases/new" element={<PurchaseFormPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
