import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DataProvider } from "@/contexts/DataContext";
import { SalesProvider } from "@/contexts/SalesContext";
import ProtectedRoute, { FullPageLoader } from "@/components/ProtectedRoute";
import Index from "./Index";
import Login from "./pages/Login";

// Pages load on demand so the initial download stays small.
const Signup = lazy(() => import("./pages/Signup"));
const Join = lazy(() => import("./pages/Join"));
const Platform = lazy(() => import("./pages/Platform"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Tenders = lazy(() => import("./pages/Tenders"));
const Registrations = lazy(() => import("./pages/Registrations"));
const Files = lazy(() => import("./pages/Files"));
const Payments = lazy(() => import("./pages/Payments"));
const Partners = lazy(() => import("./pages/Partners"));
const Employees = lazy(() => import("./pages/Employees"));
const ProjectManagement = lazy(() => import("./pages/ProjectManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Settings = lazy(() => import("./pages/Settings"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
const Deals = lazy(() => import("./pages/Deals"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const AIChatbotWidget = lazy(() => import("@/components/AIChatbotWidget"));
import { useAuth } from "@/contexts/AuthContext";
import { useEmulators } from "@/services/firebase";

// Always-visible marker so it's obvious the app is using local emulator data.
const LocalDataBadge = () =>
  useEmulators ? (
    <div className="pointer-events-none fixed left-1/2 top-1 z-[100] -translate-x-1/2 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-black shadow">
      Local data
    </div>
  ) : null;

const queryClient = new QueryClient();

// Initialize theme from localStorage on app startup
const ThemeInitializer = () => {
  useEffect(() => {
    const savedTheme = localStorage.getItem('crm-theme') as 'light' | 'dark' | 'system' | null;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (!savedTheme || savedTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(savedTheme);
    }
  }, []);

  return null;
};

// Chatbot wrapper component that handles conditional rendering
const ChatbotWrapper = () => {
  const { user, isAuthenticated } = useAuth();

  // Don't show chatbot on login/register pages or for clients
  if (!isAuthenticated || !user || user.role === 'client') {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AIChatbotWidget />
    </Suspense>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
        <DataProvider>
        <SalesProvider>
          <BrowserRouter>
            <ThemeInitializer />
            <Toaster />
            <LocalDataBadge />
            <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/join/:token" element={<Join />} />

              {/* Admin/User only routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager', 'client']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              {/* Sales (staff only) */}
              <Route path="/deals" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Deals /></ProtectedRoute>} />
              <Route path="/deals/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><DealDetail /></ProtectedRoute>} />
              <Route path="/companies" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Companies /></ProtectedRoute>} />
              <Route path="/companies/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><CompanyDetail /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Contacts /></ProtectedRoute>} />
              <Route path="/contacts/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><ContactDetail /></ProtectedRoute>} />
              <Route path="/tenders" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager']}>
                  <Tenders />
                </ProtectedRoute>
              } />
              <Route path="/registrations" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager']}>
                  <Registrations />
                </ProtectedRoute>
              } />
              <Route path="/files" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager']}>
                  <Files />
                </ProtectedRoute>
              } />
              <Route path="/payments" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager']}>
                  <Payments />
                </ProtectedRoute>
              } />
              <Route path="/partners" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'manager']}>
                  <Partners />
                </ProtectedRoute>
              } />
              <Route path="/employees" element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <Employees />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              {/* Super admin only (the page itself checks isOwner) */}
              <Route path="/platform" element={
                <ProtectedRoute>
                  <Platform />
                </ProtectedRoute>
              } />

              {/* Projects - accessible to all roles but filtered for clients */}
              <Route path="/projects" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'client', 'manager']}>
                  <Projects />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id" element={
                <ProtectedRoute allowedRoles={['admin', 'user', 'client', 'manager']}>
                  <ProjectManagement />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <ChatbotWrapper />
          </BrowserRouter>
        </SalesProvider>
        </DataProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;