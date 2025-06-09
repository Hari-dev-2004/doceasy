import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, ArrowRight, User } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import axios from "axios";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config";

const DoctorLogin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      // Call the login API
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });
      
      const { access_token, user } = response.data;
      
      // Check if user is a doctor
      if (user.role !== 'doctor') {
        setError("This login is for doctors only. Please use the appropriate login page.");
        setIsLoading(false);
        return;
      }
      
      // Store token and user data in local storage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_role', user.role);
      
      // Check if user has a complete profile based on user data from backend
      if (user.profileCompleted && user.verificationStatus === 'approved') {
        // Existing user with complete and approved profile - redirect to dashboard
        navigate("/dashboard/doctor");
        toast({
          title: "Login successful",
          description: `Welcome back, Dr. ${user.name || 'Doctor'}`,
        });
      } else if (user.profileCompleted && user.verificationStatus === 'pending') {
        // Profile completed but pending admin approval
        navigate("/dashboard/doctor");
        toast({
          title: "Login successful",
          description: "Your profile is pending admin approval.",
        });
      } else if (user.profileCompleted && user.verificationStatus === 'rejected') {
        // Profile completed but rejected by admin
        navigate("/dashboard/doctor");
        toast({
          title: "Profile requires attention",
          description: "Your profile has been rejected. Please review and resubmit.",
          variant: "destructive",
        });
      } else {
        // Profile not completed or other status - redirect to profile creation
        navigate("/doctor-profile-creation");
        toast({
          title: "Profile incomplete",
          description: "Please complete your profile setup to continue.",
        });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      if (error.response) {
        if (error.response.status === 401) {
          setError("Invalid email or password. Please try again.");
        } else if (error.response.status === 403 && error.response.data.requires_verification) {
          // User needs to verify email
          // Store user_id in local storage to use for verification
          localStorage.setItem('verification_user_id', error.response.data.user_id);
          
          // Show toast notification and redirect to verification page
          toast({
            title: "Email verification required",
            description: "Please verify your email to continue.",
          });
          
          navigate("/verify-otp", { state: { email } });
          return;
        } else {
          setError("An error occurred during login. Please try again.");
        }
      } else {
        setError("Cannot connect to the server. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Doctor Login</h1>
            <p className="text-gray-600">Access your practitioner dashboard</p>
          </div>
          
          <Card className="border-gray-200 shadow-md">
            <CardHeader className="space-y-1 pb-6">
              <div className="w-16 h-16 bg-medical-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-medical-teal" />
              </div>
              <CardTitle className="text-xl text-center">Welcome Doctor</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your practitioner account
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-gray-300"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-medical-teal hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-gray-300 pr-10"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe} 
                    onCheckedChange={(checked) => setRememberMe(checked === true)} 
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600">
                    Remember me for 30 days
                  </Label>
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
                      Signing in...
                    </span>
                  ) : (
                    <span>Sign in</span>
                  )}
                </Button>
              </form>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-gray-500">Need help?</span>
                </div>
              </div>
              
              <div className="text-center">
                <span className="text-sm text-gray-600 block mb-2">Having trouble accessing your account?</span>
                <Link to="/contact" className="text-sm text-medical-teal hover:underline">
                  Contact technical support
                </Link>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
              <div className="text-sm text-gray-600">
                New to DocEasy?{" "}
                <Link to="/doctor-registration" className="text-medical-teal hover:underline font-medium">
                  Apply as a doctor
                </Link>
              </div>
            </CardFooter>
          </Card>
          
          <div className="mt-6">
            <div className="text-center">
              <Link to="/login/patient" className="inline-flex items-center text-sm text-medical-teal hover:underline">
                Login as a patient instead
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

export default DoctorLogin;
