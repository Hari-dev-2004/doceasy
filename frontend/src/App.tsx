import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PatientLogin from "./pages/login/Patient";
import DoctorLogin from "./pages/login/Doctor";
import AdminLogin from "./pages/login/Admin";
import Register from "./pages/Register";
import DoctorRegistration from "./pages/DoctorRegistration";
import DoctorProfileCreation from "./pages/DoctorProfileCreation";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyOTP from "./pages/VerifyOTP";
import NotFound from "./pages/NotFound";
import PatientDashboard from "./pages/dashboard/Patient";
import DoctorDashboardNew from "./pages/dashboard/DoctorDashboardNew";
import AdminDashboardNew from "./pages/dashboard/AdminDashboardNew";
import FindDoctors from "./pages/FindDoctors";
import DoctorDetails from "./pages/DoctorDetails";
import BookConsultation from "./pages/BookConsultation";
import VideoCall from "./pages/VideoCall";
import CheckoutPage from "./pages/CheckoutPage";
import Feedback from "./pages/Feedback";
import DebugPage from "./pages/DebugPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login/patient" element={<PatientLogin />} />
          <Route path="/login/doctor" element={<DoctorLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/doctor-registration" element={<DoctorRegistration />} />
          <Route path="/doctor-profile-creation" element={<DoctorProfileCreation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />

          
          {/* Debug route for troubleshooting */}
          <Route path="/debug" element={<DebugPage />} />
          
          {/* Dashboard routes */}
          <Route path="/dashboard/patient" element={<PatientDashboard />} />
          <Route path="/dashboard/doctor" element={<DoctorDashboardNew />} />
          <Route path="/dashboard/admin" element={<AdminDashboardNew />} />
          
          {/* Feature routes */}
          <Route path="/find-doctors" element={<FindDoctors />} />
          <Route path="/doctor/:doctorId" element={<DoctorDetails />} />
          <Route path="/book/:doctorId" element={<BookConsultation />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/video-call/:appointmentId" element={<VideoCall />} />
          <Route path="/feedback/:id" element={<Feedback />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
