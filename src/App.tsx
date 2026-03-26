import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import AIChatbotWidget from "@/components/AIChatbotWidget";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tenders from "./pages/Tenders";
import Registrations from "./pages/Registrations";
import Files from "./pages/Files";
import Payments from "./pages/Payments";
import Partners from "./pages/Partners";
import Employees from "./pages/Employees";
import ProjectManagement from "./pages/ProjectManagement";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

// Chatbot wrapper component that handles conditional rendering
const ChatbotWrapper = () => {
  const { user, isAuthenticated } = useAuth();

  // Don't show chatbot on login/register pages or for clients
  if (!isAuthenticated || !user || user.role === 'client') {
    return null;
  }

  return <AIChatbotWidget />;
};

const App = () => {
  console.log('App component rendering...');
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Register />
                </ProtectedRoute>
              } />

              {/* Admin/User only routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/tenders" element={
                <ProtectedRoute>
                  <Tenders />
                </ProtectedRoute>
              } />
              <Route path="/registrations" element={
                <ProtectedRoute>
                  <Registrations />
                </ProtectedRoute>
              } />
              <Route path="/files" element={
                <ProtectedRoute>
                  <Files />
                </ProtectedRoute>
              } />
              <Route path="/payments" element={
                <ProtectedRoute>
                  <Payments />
                </ProtectedRoute>
              } />
              <Route path="/partners" element={
                <ProtectedRoute>
                  <Partners />
                </ProtectedRoute>
              } />
              <Route path="/employees" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Employees />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />

              {/* Projects - accessible to all roles but filtered for clients */}
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={
                <ProtectedRoute>
                  <ProjectManagement />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ChatbotWrapper />
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;