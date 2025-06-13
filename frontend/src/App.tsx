import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="text-red-500 mb-4 flex justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6 text-center">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="mr-2"
              >
                Go Home
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global error handler for uncaught errors
const GlobalErrorHandler = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
      setHasError(true);
      event.preventDefault();
    };

    window.addEventListener("error", handleGlobalError);
    return () => window.removeEventListener("error", handleGlobalError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-red-500 mb-4 flex justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
            Application Error
          </h1>
          <p className="text-gray-600 mb-6 text-center">
            An unexpected error occurred. Please try again.
          </p>
          <div className="flex justify-center">
            <Button
              onClick={() => {
                window.location.href = "/";
              }}
              className="mr-2"
            >
              Go Home
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <GlobalErrorHandler>
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
              
              {/* Redirect routes */}
              <Route path="/appointments" element={<Navigate to="/" replace />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorHandler>
  </ErrorBoundary>
);

export default App;
