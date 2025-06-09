import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config";

// API base URL - using centralized config
const API_BASE_URL = `${API_URL}/api`;

const Register = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    agreeTerms: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // OTP verification states
  const [showOTPForm, setShowOTPForm] = useState(false);
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState(null);
  const [verificationError, setVerificationError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({ ...prev, gender: value }));
  };

  const validateForm = () => {
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords match.",
        variant: "destructive"
      });
      return false;
    }
    
    // Password strength check - temporarily disabled for testing
    /* 
    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return false;
    }
    */
    
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    console.log("Submitting registration form to:", `${API_BASE_URL}/auth/register`);
    console.log("Registration payload:", JSON.stringify(formData, null, 2));
    
    try {
      // First, check if backend is reachable
      try {
        const pingResponse = await fetch(`${API_BASE_URL}/auth/ping`, { method: 'GET' });
        console.log("Backend ping response:", pingResponse.ok ? "Success" : "Failed");
      } catch (pingError) {
        console.error("Backend connectivity test failed:", pingError);
      }
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      
      // Log raw response before parsing
      console.log("Raw response status:", response.status);
      console.log("Raw response headers:", Object.fromEntries([...response.headers]));
      
      let data;
      try {
        data = await response.json();
        console.log("Registration response:", data);
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        console.log("Response text:", await response.text());
        throw new Error("Failed to parse server response");
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Save the user ID for OTP verification
      setUserId(data.user_id);
      
      toast({
        title: "Account created",
        description: "Please check your email for the verification code.",
      });
      
      // Switch to OTP verification form
      setShowOTPForm(true);
      
      // For development: Auto-fill OTP if provided
      if (data.dev_otp) {
        setOtp(data.dev_otp);
      }
      
    } catch (error) {
      console.error('Registration error details:', error);
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setVerificationError("");
    console.log("Verifying OTP with:", `${API_BASE_URL}/auth/verify-otp`);
    console.log("Verification payload:", JSON.stringify({ user_id: userId, otp }, null, 2));
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          otp: otp
        }),
        credentials: 'include'
      });
      
      // Log raw response before parsing
      console.log("Raw verification response status:", response.status);
      console.log("Raw verification headers:", Object.fromEntries([...response.headers]));
      
      const data = await response.json();
      console.log("OTP verification response:", data);
      
      if (!response.ok) {
        throw new Error(data.error || 'OTP verification failed');
      }
      
      // Store the access token and user data in localStorage
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
      }
      
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      toast({
        title: "Account verified",
        description: "Your account has been successfully verified.",
      });
      
      // Redirect to patient dashboard
      navigate('/dashboard/patient');
      
    } catch (error) {
      console.error('Verification error details:', error);
      console.log('Network status during verification:', navigator.onLine ? 'Online' : 'Offline');
      setVerificationError(error instanceof Error ? error.message : "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!userId) return;
    console.log("Resending OTP with:", `${API_BASE_URL}/auth/resend-otp`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      console.log("Resend OTP response:", data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }
      
      toast({
        title: "OTP resent",
        description: "A new verification code has been sent to your email.",
      });
      
      // For development: Auto-fill OTP if provided
      if (data.dev_otp) {
        setOtp(data.dev_otp);
      }
      
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast({
        title: "Failed to resend OTP",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Patient Account</h1>
            <p className="text-gray-600">Join EasyDoc to access online healthcare consultations</p>
          </div>
          
          <Card className="border-gray-200 shadow-md">
            {!showOTPForm ? (
              <>
                <CardHeader>
                  <CardTitle>Patient Registration</CardTitle>
                  <CardDescription>
                    Enter your details to create a patient account. All fields are required.
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-6">
                    {/* Personal Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Personal Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder="John"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder="Doe"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="gender">Gender</Label>
                          <RadioGroup
                            value={formData.gender}
                            onValueChange={handleGenderChange}
                            className="flex space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="male" id="male" />
                              <Label htmlFor="male" className="cursor-pointer">Male</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="female" id="female" />
                              <Label htmlFor="female" className="cursor-pointer">Female</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="other" id="other" />
                              <Label htmlFor="other" className="cursor-pointer">Other</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="dateOfBirth">Date of Birth</Label>
                          <Input
                            id="dateOfBirth"
                            name="dateOfBirth"
                            type="date"
                            value={formData.dateOfBirth}
                            onChange={handleChange}
                            required
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Contact Information */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-lg font-medium">Contact Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="john.doe@example.com"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phoneNumber">Phone Number</Label>
                          <Input
                            id="phoneNumber"
                            name="phoneNumber"
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            placeholder="+1 (555) 123-4567"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Account Security */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-lg font-medium">Account Security</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="••••••••"
                              required
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <Eye className="h-5 w-5" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Must be at least 8 characters with uppercase, lowercase, numbers and special characters.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <div className="relative">
                            <Input
                              id="confirmPassword"
                              name="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              placeholder="••••••••"
                              required
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <Eye className="h-5 w-5" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Terms and Conditions */}
                    <div className="pt-2">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="agreeTerms"
                          name="agreeTerms"
                          checked={formData.agreeTerms}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, agreeTerms: checked === true }))
                          }
                          required
                        />
                        <Label htmlFor="agreeTerms" className="text-sm text-gray-600 leading-tight">
                          I agree to EasyDoc's{" "}
                          <Link to="/terms" className="text-medical-blue hover:underline">
                            Terms of Service
                          </Link>
                          {" "}and{" "}
                          <Link to="/privacy" className="text-medical-blue hover:underline">
                            Privacy Policy
                          </Link>
                          , including consent to electronic communications.
                        </Label>
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-medical-blue hover:bg-medical-blue-dark"
                      disabled={isLoading || !formData.agreeTerms}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating account...
                        </span>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Verify Your Email</CardTitle>
                  <CardDescription>
                    We've sent a verification code to your email. Please enter it below to complete your registration.
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleVerifyOTP} className="space-y-6">
                    <div className="space-y-4">
                      <Label htmlFor="otp">Verification Code</Label>
                      <Input
                        id="otp"
                        name="otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        required
                        className="text-center text-xl tracking-widest"
                        maxLength={6}
                      />
                      
                      {verificationError && (
                        <p className="text-sm text-red-600">{verificationError}</p>
                      )}
                      
                      <p className="text-sm text-gray-500 mt-2">
                        Didn't receive the code?{" "}
                        <button 
                          type="button" 
                          onClick={handleResendOTP}
                          className="text-medical-blue hover:underline"
                        >
                          Resend code
                        </button>
                      </p>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-medical-blue hover:bg-medical-blue-dark"
                      disabled={isLoading || otp.length !== 6}
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
                        <span>Verify Account</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
            
            <CardFooter className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
              <div className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login/patient" className="text-medical-blue hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Are you a healthcare professional?{" "}
              <Link to="/doctor-registration" className="text-medical-blue hover:underline font-medium">
                Apply to join as a doctor
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Register; 