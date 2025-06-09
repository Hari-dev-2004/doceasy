import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config";

const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      console.log("Password reset email request successful:", data);
      setSubmitted(true);
      
      toast({
        title: "Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });
      
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email. Please try again.';
      setError(errorMessage);
      
      toast({
        title: "Failed to Send Reset Email",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Recover Your Password</h1>
            <p className="text-gray-600">We'll send you instructions to reset your password</p>
          </div>
          
          <Card className="border-gray-200 shadow-md">
            {!submitted ? (
              <>
                <CardHeader className="space-y-1">
                  <div className="w-16 h-16 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-medical-blue" />
                  </div>
                  <CardTitle className="text-xl text-center">Forgot your password?</CardTitle>
                  <CardDescription className="text-center">
                    Enter your email address and we'll send you a link to reset your password
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
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-medical-blue hover:bg-medical-blue-dark" 
                      disabled={isLoading || !email}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        <span>Send Reset Instructions</span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="space-y-1">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-xl text-center">Check Your Email</CardTitle>
                  <CardDescription className="text-center">
                    We've sent password reset instructions to <strong>{email}</strong>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <p className="text-gray-600 mb-4">
                    If an account with that email exists, we have sent password reset instructions to your email.
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    Please check your email inbox and follow the instructions to reset your password.
                    If you don't receive an email within a few minutes, please check your spam folder.
                  </p>
                  
                  <Button 
                    onClick={() => {
                      setSubmitted(false);
                      setEmail("");
                      setError("");
                    }}
                    variant="outline" 
                    className="mt-4 border-gray-300"
                  >
                    Try another email
                  </Button>
                </CardContent>
              </>
            )}
            
            <CardFooter className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
              <Link to="/login/patient" className="inline-flex items-center text-sm text-medical-blue hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Login
              </Link>
            </CardFooter>
          </Card>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="text-medical-blue hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ForgotPassword;
