
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const VerifyOTP = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.match(/^[0-9]$/)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      // Auto-focus next input
      if (index < otp.length - 1) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      }
    } else if (value === "") {
      // Allow clearing input
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      // Move focus to previous input on backspace if current is empty
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain");
    if (pastedData.match(/^[0-9]{6}$/)) {
      const digits = pastedData.split("");
      setOtp(digits);
      
      // Focus last input
      const lastInput = document.getElementById(`otp-5`);
      if (lastInput) {
        lastInput.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const otpValue = otp.join("");
    
    // Simulate OTP verification
    setTimeout(() => {
      console.log("OTP submitted:", otpValue);
      setIsLoading(false);
      
      // Here you would verify the OTP and navigate the user accordingly
      navigate("/login/patient");
    }, 1500);
  };

  const handleResendOTP = () => {
    if (!canResend) return;
    
    setCanResend(false);
    setCountdown(30);
    
    // Simulate OTP resend
    console.log("Resending OTP...");
    
    // Here you would call your API to resend OTP
  };

  const isOtpComplete = otp.every(digit => digit !== "");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-600">Enter the verification code sent to your email</p>
          </div>
          
          <Card className="border-gray-200 shadow-md">
            <CardHeader className="space-y-1">
              <div className="w-16 h-16 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-8 w-8 text-medical-blue" />
              </div>
              <CardTitle className="text-xl text-center">One-Time Password</CardTitle>
              <CardDescription className="text-center">
                We've sent a 6-digit code to your email address. Enter it below to verify your account.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center space-x-2">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      className="w-12 h-12 text-center text-lg p-0"
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      autoComplete="off"
                      maxLength={1}
                    />
                  ))}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-medical-blue hover:bg-medical-blue-dark" 
                  disabled={isLoading || !isOtpComplete}
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
                    <span>Verify & Continue</span>
                  )}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Didn't receive the code?{" "}
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className={`font-medium ${
                      canResend
                        ? "text-medical-blue hover:underline cursor-pointer"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!canResend}
                  >
                    {canResend ? "Resend code" : `Resend in ${countdown}s`}
                  </button>
                </p>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-center border-t border-gray-100 bg-gray-50/50 p-4">
              <Link to="/login/patient" className="inline-flex items-center text-sm text-medical-blue hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Login
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default VerifyOTP;
