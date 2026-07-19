import { DataProvider } from './context/DataProvider';
import UnifiedDashboard from './pages/UnifiedDashboard';

export default function App() {
  return (
    <DataProvider>
      <UnifiedDashboard />
    </DataProvider>
  );
}
