import { Dashboard } from './components/Dashboard'
import { LocaleProvider } from './react/LocaleProvider'
import { StoreProvider } from './react/StoreProvider'

export default function App() {
  return (
    <LocaleProvider>
      <StoreProvider>
        <Dashboard />
      </StoreProvider>
    </LocaleProvider>
  )
}
