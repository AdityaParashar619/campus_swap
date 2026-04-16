import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

// Pages
import Bounties from './pages/Bounties';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Listings from './pages/Listings';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Error from './pages/Error';
import NotFound from './pages/NotFound';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  console.log('🔐 ProtectedRoute - loading:', loading, 'user:', user);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function AppContent() {
  console.log('📱 App rendering - AppContent');
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/listings" element={<ProtectedRoute><Listings /></ProtectedRoute>} />
        <Route path="/bounties" element={<ProtectedRoute><Bounties /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/error" element={<Error />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

