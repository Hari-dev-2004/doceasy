import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config";

const ResetPassword = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [error, setError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    // Extract email and token from URL parameters
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');
    
    if (!emailParam || !tokenParam) {
      setError("Invalid reset link. Please request a new password reset.");
      setIsVerifying(false);
      return;
    }
    
    setEmail(emailParam);
    setResetToken(tokenParam);
    
    // Verify the token
    verifyResetToken(emailParam, tokenParam);
  }, [searchParams]);

  const verifyResetToken = async (email: string, token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-reset-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email,
          reset_token: token 
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setTokenValid(true);
        setUserRole(data.user_role);
      } else {
        setError(data.message || "Invalid or expired reset token.");
        setTokenValid(false);
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setError("Failed to verify reset token. Please try again.");
      setTokenValid(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      console.log("Password reset successful:", data);
      setResetSuccess(true);
      
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      
      // Redirect to appropriate login page after 3 seconds
      setTimeout(() => {
        if (userRole === 'doctor') {
          navigate('/login/doctor');
        } else if (userRole === 'admin') {
          navigate('/login/admin');
        } else {
          navigate('/login/patient');
        }
      }, 3000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
      setError(errorMessage);
      
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'doctor': return 'Doctor';
      case 'admin': return 'Administrator';
      default: return 'Patient';
    }
  };

  const getLoginPath = (role: string) => {
    switch (role) {
      case 'doctor': return '/login/doctor';
      case 'admin': return '/login/admin';
      default: return '/login/patient';
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying reset link...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Your Password</h1>
            <p className="text-gray-600">Enter your new password below</p>
          </div>
          
          <Card className="border-gray-200 shadow-md">
            {!tokenValid ? (
              <>
                <CardHeader className="space-y-1">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <CardTitle className="text-xl text-center text-red-600">Invalid Reset Link</CardTitle>
                  <CardDescription className="text-center">
                    This password reset link is invalid or has expired
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <p className="text-gray-600 mb-4">
                    {error}
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    Password reset links expire after 1 hour for security reasons.
                  </p>
                  
                  <Link to="/forgot-password">
                    <Button className="w-full bg-medical-blue hover:bg-medical-blue-dark">
                      Request New Reset Link
                    </Button>
                  </Link>
                </CardContent>
              </>
            ) : resetSuccess ? (
              <>
                <CardHeader className="space-y-1">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-xl text-center text-green-600">Password Reset Successful</CardTitle>
                  <CardDescription className="text-center">
                    Your password has been updated successfully
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <p className="text-gray-600 mb-4">
                    You can now log in with your new password.
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    Redirecting you to the login page...
                  </p>
                  
                  <Link to={getLoginPath(userRole)}>
                    <Button className="w-full bg-medical-blue hover:bg-medical-blue-dark">
                      Go to {getRoleDisplayName(userRole)} Login
                    </Button>
                  </Link>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1">
                  <div className="w-16 h-16 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-medical-blue" />
                  </div>
                  <CardTitle className="text-xl text-center">Set New Password</CardTitle>
                  <CardDescription className="text-center">
                    {userRole && `Resetting password for ${getRoleDisplayName(userRole)} account`}
                    <br />
                    <strong className="text-sm">{email}</strong>
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                        {error}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          className="border-gray-300 pr-10"
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
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="border-gray-300 pr-10"
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
                    
                    <div className="text-sm text-gray-600">
                      <p>Password requirements:</p>
                      <ul className="list-disc list-inside text-xs mt-1">
                        <li>At least 6 characters long</li>
                        <li>Must match confirmation password</li>
                      </ul>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-medical-blue hover:bg-medical-blue-dark" 
                      disabled={isLoading || !newPassword || !confirmPassword}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating Password...
                        </span>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
            
            <div className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
              <Link to="/login/patient" className="inline-flex items-center text-sm text-medical-blue hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ResetPassword; 