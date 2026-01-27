import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { MainLayout } from './components/Layout'
import { LoginForm, RegisterForm } from './components/Auth'
import { Dashboard, Recipes, Meals, MealForm, Pantry, Health, House, RecipeDetail, Settings, GrocySettings, Stores, ShoppingLists, ShoppingListForm, ShoppingListDetail, LoadVerification, DatabaseImport, Categories, SqlConsole } from './pages'
import RecipeForm from './pages/RecipeForm'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginForm />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterForm />
          </PublicRoute>
        }
      />

      {/* Private routes */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/recipes"
        element={
          <PrivateRoute>
            <MainLayout>
              <Recipes />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/recipes/new"
        element={
          <PrivateRoute>
            <MainLayout>
              <RecipeForm />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/recipes/:id/edit"
        element={
          <PrivateRoute>
            <MainLayout>
              <RecipeForm />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/recipes/:id"
        element={
          <PrivateRoute>
            <MainLayout>
              <RecipeDetail />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/meals"
        element={
          <PrivateRoute>
            <MainLayout>
              <Meals />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/meals/new"
        element={
          <PrivateRoute>
            <MainLayout>
              <MealForm />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/pantry"
        element={
          <PrivateRoute>
            <MainLayout>
              <Pantry />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/health"
        element={
          <PrivateRoute>
            <MainLayout>
              <Health />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/house"
        element={
          <PrivateRoute>
            <MainLayout>
              <House />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <MainLayout>
              <Settings />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/grocy"
        element={
          <PrivateRoute>
            <MainLayout>
              <GrocySettings />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/stores"
        element={
          <PrivateRoute>
            <MainLayout>
              <Stores />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/categories"
        element={
          <PrivateRoute>
            <MainLayout>
              <Categories />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/shopping-lists"
        element={
          <PrivateRoute>
            <MainLayout>
              <ShoppingLists />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/shopping-lists/new"
        element={
          <PrivateRoute>
            <MainLayout>
              <ShoppingListForm />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/shopping-lists/:id"
        element={
          <PrivateRoute>
            <MainLayout>
              <ShoppingListDetail />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/shopping-lists/:id/edit"
        element={
          <PrivateRoute>
            <MainLayout>
              <ShoppingListForm />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/shopping-lists/:id/verify"
        element={
          <PrivateRoute>
            <MainLayout>
              <LoadVerification />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/import-database"
        element={
          <PrivateRoute>
            <MainLayout>
              <DatabaseImport />
            </MainLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/sql-console"
        element={
          <PrivateRoute>
            <MainLayout>
              <SqlConsole />
            </MainLayout>
          </PrivateRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
