import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import ScanReport from './pages/ScanReport';
import ProtectedRoute from './components/ProtectedRoute';
import TopBar from './components/TopBar';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="center-screen">Loading session…</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        element={
          <ProtectedRoute>
            <TopBar />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/scans/:id" element={<ScanReport />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
