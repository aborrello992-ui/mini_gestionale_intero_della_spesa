import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { AdminRoute, ProtectedRoute } from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import ProductsPage from './pages/ProductsPage'
import ErrorBoundary from './components/feedback/ErrorBoundary'
import Loading from './components/Loading'

const CashPage = lazy(() => import('./pages/CashPage'))
const DebtsPage = lazy(() => import('./pages/DebtsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const GuestPage = lazy(() => import('./pages/GuestPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ManagementPage = lazy(() => import('./pages/ManagementPage'))
const ShoppingListPage = lazy(() => import('./pages/ShoppingListPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'))

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/guest" element={<GuestPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<ProductsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="debts" element={<DebtsPage />} />
              <Route path="shopping-list" element={<ShoppingListPage />} />
              <Route path="cash" element={<CashPage />} />
              <Route path="movements" element={<HistoryPage />} />
              <Route element={<AdminRoute />}>
                <Route path="admin/users" element={<UsersPage />} />
                <Route path="admin/management" element={<ManagementPage />} />
                <Route path="admin/products" element={<AdminProductsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
