import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, ArrowRight, User, AlertTriangle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { API_URL } from "@/config";

// Using relative API paths which will work with the Vite proxy configured in vite.config.ts
// const API_URL = '';

const DoctorRegistration = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    role: "doctor" // Explicitly set role as doctor
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // OTP verification states
  const [showOTPForm, setShowOTPForm] = useState(false);
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [resendingCode, setResendingCode] = useState(false);

  // Check if the server is running when the component mounts
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        // Try different endpoints to ensure we can connect to the backend
        try {
          // Try the health check endpoint first
          await axios.get(`${API_URL}/api/health-check`, { timeout: 5000 });
          setServerStatus('online');
          console.log('Server is online via health check');
          return;
        } catch (err) {
          // If health check fails, try the ping endpoint
          console.log('Health check failed, trying ping endpoint');
          await axios.get(`${API_URL}/api/auth/ping`, { timeout: 5000 });
          setServerStatus('online');
          console.log('Server is online via ping');
          return;
        }
      } catch (error) {
        console.error('Server health checks failed:', error);
        setServerStatus('offline');
        setError("Cannot connect to the server. The backend service might be offline. Please contact the administrator or try again later.");
      }
    };
    
    checkServerStatus();
    
    // Retry connection check every 10 seconds
    const intervalId = setInterval(() => {
      if (serverStatus === 'offline') {
        console.log('Retrying server connection...');
        checkServerStatus();
      }
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [serverStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if server is offline before attempting registration
    if (serverStatus === 'offline') {
      setError("Backend server is not available. Please contact the administrator or try again later.");
      return;
    }
    
    // Basic form validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please ensure your passwords match.");
      return;
    }
    
    if (!formData.agreeTerms) {
      setError("You must agree to the terms and conditions to register.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      // Register the doctor
      const response = await axios.post(`${API_URL}/api/auth/register`, formData);
      
      // Check if OTP verification is required
      if (response.data.requires_verification) {
        setUserId(response.data.user_id);
        // Auto-fill OTP in development mode if provided
        if (response.data.dev_otp) {
          setOtp(response.data.dev_otp);
        }
        setShowOTPForm(true);
        
        toast({
          title: "Registration successful",
          description: "Please check your email for the verification code.",
        });
      } else {
        // If no verification required, store token and redirect
        const { access_token, user } = response.data;
        
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('user_role', user.role);
        
        toast({
          title: "Registration successful",
          description: "You're now registered as a doctor.",
        });
        
        // Redirect to doctor profile creation page
        navigate('/doctor-profile-creation');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.response) {
        if (error.response.status === 409) {
          // 409 Conflict - Email already exists
          setError("This email address is already registered. Please use the login page to access your account.");
          
          // Display a toast notification as well for better visibility
          toast({
            title: "Account already exists",
            description: "An account with this email already exists. Please log in instead.",
            variant: "destructive",
          });
        } else if (error.response.data && error.response.data.error) {
          setError(error.response.data.error);
        } else {
          setError("Registration failed. Please try again.");
        }
      } else if (error.request) {
        // Request was made but no response received
        setServerStatus('offline');
        setError("Cannot connect to the server. The backend service might be offline. Please contact the administrator or try again later.");
      } else {
        // Error setting up the request
        setError("An error occurred while sending your registration. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await axios.post(`${API_URL}/api/doctor/verify-otp`, {
        user_id: userId,
        otp: otp
      });
      
      // Store token and user info
      const { access_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_role', user.role);
      
      toast({
        title: "Account verified",
        description: "Your account has been successfully verified.",
      });
      
      // Redirect to doctor profile creation page
      navigate('/doctor-profile-creation');
    } catch (error: any) {
      console.error('Verification error:', error);
      
      if (error.response) {
        if (error.response.status === 401) {
          // Invalid OTP
          setError("Invalid verification code. Please check the code and try again.");
        } else if (error.response.status === 410) {
          // Expired OTP
          setError("Verification code has expired. Please request a new code.");
        } else if (error.response.data && error.response.data.error) {
          setError(error.response.data.error);
        } else {
          setError("Verification failed. Please try again.");
        }
      } else if (error.request) {
        // Request was made but no response received
        setError("Cannot connect to the server. Please check your internet connection and try again.");
      } else {
        // Error setting up the request
        setError("An error occurred during verification. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to resend the verification code
  const handleResendCode = async () => {
    if (!userId) {
      setError("Unable to resend verification code. Please try registering again.");
      return;
    }
    
    setResendingCode(true);
    setError("");
    
    try {
      const response = await axios.post(`${API_URL}/api/doctor/resend-otp`, {
        user_id: userId
      });
      
      // If dev_otp is provided, auto-fill it (useful for development)
      if (response.data.dev_otp) {
        setOtp(response.data.dev_otp);
      }
      
      toast({
        title: "Verification code resent",
        description: "Please check your email for the new verification code.",
      });
    } catch (error: any) {
      console.error('Error resending verification code:', error);
      
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError("Failed to resend verification code. Please try again.");
      }
    } finally {
      setResendingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-md">
          {!showOTPForm ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Doctor Registration</h1>
                <p className="text-gray-600">Join our network of healthcare professionals</p>
              </div>
              
              <Card className="border-gray-200 shadow-md">
                <CardHeader className="space-y-1 pb-6">
                  <div className="w-16 h-16 bg-medical-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-8 w-8 text-medical-teal" />
                  </div>
                  <CardTitle className="text-xl text-center">Create Doctor Account</CardTitle>
                  <CardDescription className="text-center">
                    Enter your details to register as a healthcare provider
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {serverStatus === 'offline' && (
                    <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-md flex items-start">
                      <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold">Backend Server Offline</h4>
                        <p className="text-sm mt-1">
                          The backend server appears to be offline. Registration is currently unavailable.
                        </p>
                        <p className="text-sm mt-2">
                          Please try again later or contact technical support if the issue persists.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                      {error}
                      {error.includes("already registered") && (
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            className="w-full mt-1 border-medical-teal text-medical-teal hover:bg-medical-teal/10"
                            onClick={() => navigate('/login/doctor')}
                          >
                            Go to Login Page
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="doctor@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="border-gray-300"
                        disabled={serverStatus === 'offline'}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          className="border-gray-300 pr-10"
                          disabled={serverStatus === 'offline'}
                        />
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                          disabled={serverStatus === 'offline'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                          className="border-gray-300 pr-10"
                          disabled={serverStatus === 'offline'}
                        />
                        <button
                          type="button"
                          onClick={toggleConfirmPasswordVisibility}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                          disabled={serverStatus === 'offline'}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="agreeTerms" 
                        name="agreeTerms"
                        checked={formData.agreeTerms} 
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreeTerms: checked === true }))} 
                        disabled={serverStatus === 'offline'}
                      />
                      <Label htmlFor="agreeTerms" className="text-sm text-gray-600">
                        I agree to the <Link to="/terms" className="text-medical-teal hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-medical-teal hover:underline">Privacy Policy</Link>
                      </Label>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-medical-teal hover:bg-medical-teal/90" 
                      disabled={isLoading || serverStatus === 'offline'}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Account...
                        </span>
                      ) : serverStatus === 'offline' ? (
                        <span>Server Offline</span>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
                
                <CardFooter className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
                  <div className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link to="/login/doctor" className="text-medical-teal hover:underline font-medium">
                      Sign in
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            </>
          ) : (
            // OTP Verification Form
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
                <p className="text-gray-600">Enter the code sent to your email</p>
              </div>
              
              <Card className="border-gray-200 shadow-md">
                <CardHeader className="space-y-1 pb-6">
                  <CardTitle className="text-xl text-center">Email Verification</CardTitle>
                  <CardDescription className="text-center">
                    We've sent a verification code to your email. Please enter it below.
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                  
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Verification Code</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        className="border-gray-300 text-center text-lg tracking-wider"
                        maxLength={6}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-medical-teal hover:bg-medical-teal/90" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verifying...
                        </span>
                      ) : (
                        <span>Verify Email</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
                
                <CardFooter className="flex flex-col items-center border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                  <div className="text-sm text-gray-600">
                    Didn't receive a code?{" "}
                    <button 
                      className="text-medical-teal hover:underline font-medium"
                      onClick={handleResendCode}
                      disabled={resendingCode}
                    >
                      {resendingCode ? "Sending..." : "Resend"}
                    </button>
                  </div>
                </CardFooter>
              </Card>
            </>
          )}
          
          <div className="mt-6">
            <div className="text-center">
              <Link to="/login/patient" className="inline-flex items-center text-sm text-medical-teal hover:underline">
                Register as a patient instead
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default DoctorRegistration; 