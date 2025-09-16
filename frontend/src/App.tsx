import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import CreateAgent from "./pages/CreateAgent";
import AllAgents from "./pages/AllAgents";
import AICallInterface from "./components/AICallInterface";
import CommunicationHub from "./pages/CommunicationHub";
import CRMIntegration from "./pages/CRMIntegration";
import Analytics from "./pages/Analytics";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./components/auth/AuthPage";
import { UserProfile } from "./components/auth/UserProfile";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import TrunkManagement from "./components/TrunkManagement";
import Conversations from "./pages/Conversations";
import Campaigns from "./pages/Campaigns";
import Contacts from "./pages/Contacts";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Landing page route */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Authentication routes */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* App routes with layout - Protected */}
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/create-agent" element={<ProtectedRoute><AppLayout><CreateAgent /></AppLayout></ProtectedRoute>} />
            <Route path="/all-agents" element={<ProtectedRoute><AppLayout><AllAgents /></AppLayout></ProtectedRoute>} />
            <Route path="/voice-calls" element={<ProtectedRoute><AppLayout><AICallInterface /></AppLayout></ProtectedRoute>} />
            <Route path="/communication" element={<ProtectedRoute><AppLayout><CommunicationHub /></AppLayout></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><AppLayout><CRMIntegration /></AppLayout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
            <Route path="/trunk-management" element={<ProtectedRoute><AppLayout><TrunkManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/conversations" element={<ProtectedRoute><AppLayout><Conversations /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><AppLayout><Campaigns /></AppLayout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><AppLayout><Contacts /></AppLayout></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">Bookings - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminPanel /></AppLayout></ProtectedRoute>} />
            <Route path="/white-label" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">White Label - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">User Management - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><UserProfile /></AppLayout></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">Onboarding - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">Training - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><AppLayout><div className="p-6"><h1 className="text-2xl font-bold">Support - Coming Soon</h1></div></AppLayout></ProtectedRoute>} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
