import { Dashboard } from './components/Dashboard'
import { StoreProvider } from './react/StoreProvider'

export default function App() {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  )
}
