import { lazy, Suspense } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { PageLoader } from './components/ui';
import { useAuth } from './hooks/useAuth';

const Admin = lazy(() => import('./pages/Admin'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminAcademicResources = lazy(() => import('./pages/AdminAcademicResources'));
const AdminNotices = lazy(() => import('./pages/AdminNotices'));
const About = lazy(() => import('./pages/About'));
const Bounties = lazy(() => import('./pages/Bounties'));
const Chat = lazy(() => import('./pages/Chat'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Error = lazy(() => import('./pages/Error'));
const Feedback = lazy(() => import('./pages/Feedback'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Landing = lazy(() => import('./pages/Landing'));
const Listings = lazy(() => import('./pages/Listings'));
const ListingDetails = lazy(() => import('./pages/ListingDetails'));
const MyListings = lazy(() => import('./pages/MyListings'));
const MyDepartment = lazy(() => import('./pages/MyDepartment'));
const SavedListings = lazy(() => import('./pages/SavedListings'));
const Login = lazy(() => import('./pages/Login'));
const Network = lazy(() => import('./pages/Network'));
const Notes = lazy(() => import('./pages/Notes'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NoticeBoard = lazy(() => import('./pages/NoticeBoard'));
const CampusMap = lazy(() => import('./pages/CampusMap'));
const CampusIssues = lazy(() => import('./pages/CampusIssues'));
const CreateCampusIssue = lazy(() => import('./pages/CreateCampusIssue'));
const CampusIssueDetails = lazy(() => import('./pages/CampusIssueDetails'));
const AdminCampusIssues = lazy(() => import('./pages/AdminCampusIssues'));
const AdminCampusLocations = lazy(() => import('./pages/AdminCampusLocations'));
const NoticeDetails = lazy(() => import('./pages/NoticeDetails'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Profile = lazy(() => import('./pages/Profile'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Signup = lazy(() => import('./pages/Signup'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyAlumni = lazy(() => import('./pages/VerifyAlumni'));
const AccountStatus = lazy(() => import('./pages/AccountStatus'));

const ProtectedRoute = ({ children, studentOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (studentOnly && user.role !== 'student') return <Navigate to="/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children, iam = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = iam ? ['college_admin', 'super_admin'] : ['admin', 'college_admin', 'super_admin'];
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppContent() {
  return (
    <Router>
      <Suspense fallback={<PageLoader label="Loading CampusSwap..." />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-alumni" element={<VerifyAlumni />} />
          <Route path="/account-status" element={<AccountStatus />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/listings" element={<ProtectedRoute><Listings /></ProtectedRoute>} />
          <Route path="/listings/:id" element={<ProtectedRoute><ListingDetails /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
          <Route path="/my-department" element={<ProtectedRoute><MyDepartment /></ProtectedRoute>} />
          <Route path="/saved-listings" element={<ProtectedRoute><SavedListings /></ProtectedRoute>} />
          <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
          <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
          <Route path="/bounties" element={<ProtectedRoute><Bounties /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/notices" element={<ProtectedRoute><NoticeBoard /></ProtectedRoute>} />
          <Route path="/campus-map" element={<ProtectedRoute><CampusMap /></ProtectedRoute>} />
          <Route path="/campus-issues" element={<ProtectedRoute studentOnly><CampusIssues /></ProtectedRoute>} />
          <Route path="/campus-issues/new" element={<ProtectedRoute studentOnly><CreateCampusIssue /></ProtectedRoute>} />
          <Route path="/campus-issues/:id" element={<ProtectedRoute studentOnly><CampusIssueDetails /></ProtectedRoute>} />
          <Route path="/notices/:id" element={<ProtectedRoute><NoticeDetails /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute iam><AdminUsers /></AdminRoute>} />
          <Route path="/admin/academic-resources" element={<AdminRoute><AdminAcademicResources /></AdminRoute>} />
          <Route path="/admin/notices" element={<AdminRoute><AdminNotices /></AdminRoute>} />
          <Route path="/admin/campus-locations" element={<AdminRoute><AdminCampusLocations /></AdminRoute>} />
          <Route path="/admin/campus-issues" element={<AdminRoute><AdminCampusIssues /></AdminRoute>} />
          <Route path="/error" element={<Error />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider><AppContent /></NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
