import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Video, MessageCircle, Phone, CreditCard, User, ArrowLeft, Loader2, CheckCircle, Shield, Lock, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import authService from '@/services/authService';
import httpClient from '@/services/httpClient';
import { API_URL } from "@/config";

// Using relative API paths with Vite proxy
// const API_URL = '';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  consultationFee: number;
  profile_picture?: string;
}

interface BookingData {
  doctor_id: string;
  appointment_date: string;
  consultation_type: 'video' | 'chat' | 'phone';
  reason: string;
  notes: string;
  report_complaint: string;
  urgent: boolean;
  patient_phone: string;
  patient_email: string;
  preferred_language: string;
  medical_history: string;
}

interface PaymentData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardHolderName: string;
  billingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: 'credit' | 'debit' | 'upi';
  upiId?: string;
}

interface PaymentAnimationProps {
  onComplete: () => void;
}

const PaymentSuccessAnimation: React.FC<PaymentAnimationProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="relative">
        <div className="animate-ping absolute h-20 w-20 rounded-full bg-green-400 opacity-75"></div>
        <div className="relative h-20 w-20 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-white animate-pulse" />
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-green-800">Payment Successful!</h2>
        <p className="text-green-600">Your payment has been processed successfully</p>
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Creating your appointment...</span>
        </div>
      </div>
      
      <div className="w-full max-w-xs bg-green-100 rounded-full h-2">
        <div className="bg-green-500 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
      </div>
    </div>
  );
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // State from navigation or localStorage
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [feedback, setFeedback] = useState({ rating: 0, feedback: '' });

  // Payment form state
  const [paymentData, setPaymentData] = useState<PaymentData>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardHolderName: '',
    billingAddress: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'credit',
    upiId: ''
  });

  // UI state
  const [processing, setProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success' | 'error'>('details');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showAnimation, setShowAnimation] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [sessionValidated, setSessionValidated] = useState(false);

  useEffect(() => {
    const initializeCheckout = async () => {
      try {
        // Validate session before proceeding with checkout
        console.log('Validating session for checkout...');
        
        if (!authService.isAuthenticated()) {
          console.log('User not authenticated, redirecting to login');
          toast({
            title: "Authentication Required",
            description: "Please log in as a patient to complete booking.",
            variant: "destructive"
          });
          navigate('/login/patient');
          return;
        }

        const user = authService.getUser();
        if (!user || user.role !== 'patient') {
          console.log('User is not a patient, redirecting');
          toast({
            title: "Access Denied",
            description: "Only patients can complete bookings.",
            variant: "destructive"
          });
          navigate('/login/patient');
          return;
        }

        // Ensure session is valid and refresh if needed
        try {
          await authService.ensureValidSession();
          setSessionValidated(true);
          console.log('Session validated successfully');
        } catch (error) {
          console.error('Session validation failed:', error);
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          });
          navigate('/login/patient');
          return;
        }

        // Get data from navigation state or localStorage
        if (location.state && location.state.doctor && location.state.bookingData) {
          console.log('Using navigation state data');
          setDoctor(location.state.doctor);
          setBookingData(location.state.bookingData);
          setFeedback({ rating: location.state.rating || 0, feedback: location.state.feedback || '' });
        } else {
          console.log('Fallback to localStorage');
          // Fallback to localStorage
          const pendingBooking = localStorage.getItem('pendingBooking');
          const doctorInfo = localStorage.getItem('doctorInfo');
          const bookingFeedback = localStorage.getItem('bookingFeedback');

          if (pendingBooking && doctorInfo) {
            try {
              const bookingData = JSON.parse(pendingBooking);
              const doctorData = JSON.parse(doctorInfo);
              
              // Validate essential data
              if (!bookingData.doctor_id || !bookingData.appointment_date || !bookingData.reason) {
                throw new Error('Incomplete booking data');
              }
              
              if (!doctorData.id || !doctorData.name) {
                throw new Error('Incomplete doctor data');
              }
              
              console.log('Loaded booking data:', bookingData);
              console.log('Loaded doctor data:', doctorData);
              
              setBookingData(bookingData);
              setDoctor(doctorData);
              
              if (bookingFeedback) {
                try {
                  setFeedback(JSON.parse(bookingFeedback));
                } catch (e) {
                  console.error('Failed to parse feedback data:', e);
                  setFeedback({ rating: 0, feedback: '' });
                }
              }
            } catch (error) {
              console.error('Error parsing stored data:', error);
              toast({
                title: "Invalid Booking Data",
                description: "The booking information is incomplete or corrupted. Please start the booking process again.",
                variant: "destructive"
              });
              navigate('/dashboard/patient');
              return;
            }
          } else {
            console.error('No booking data found in localStorage');
            toast({
              title: "No Booking Data Found",
              description: "Please start the booking process from the doctor selection page.",
              variant: "destructive"
            });
            navigate('/dashboard/patient');
            return;
          }
        }
      } catch (error) {
        console.error('Checkout initialization error:', error);
        toast({
          title: "Initialization Error",
          description: "Failed to initialize checkout. Please try again.",
          variant: "destructive"
        });
        navigate('/dashboard/patient');
      }
    };

    initializeCheckout();
  }, [location.state, navigate, toast]);

  // Validate payment form
  const validatePayment = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (paymentData.paymentMethod === 'upi') {
      if (!paymentData.upiId?.trim()) {
        newErrors.upiId = 'UPI ID is required';
      } else if (!/^[\w.-]+@[\w.-]+$/.test(paymentData.upiId)) {
        newErrors.upiId = 'Invalid UPI ID format';
      }
    } else {
      // Validate card details
      if (!paymentData.cardHolderName.trim()) {
        newErrors.cardHolderName = 'Cardholder name is required';
      }

      if (!paymentData.cardNumber.trim()) {
        newErrors.cardNumber = 'Card number is required';
      } else if (paymentData.cardNumber.replace(/\s/g, '').length < 16) {
        newErrors.cardNumber = 'Invalid card number';
      }

      if (!paymentData.expiryDate.trim()) {
        newErrors.expiryDate = 'Expiry date is required';
      } else if (!/^\d{2}\/\d{2}$/.test(paymentData.expiryDate)) {
        newErrors.expiryDate = 'Invalid expiry date format (MM/YY)';
      }

      if (!paymentData.cvv.trim()) {
        newErrors.cvv = 'CVV is required';
      } else if (paymentData.cvv.length < 3) {
        newErrors.cvv = 'Invalid CVV';
      }

      if (!paymentData.billingAddress.trim()) {
        newErrors.billingAddress = 'Billing address is required';
      }

      if (!paymentData.city.trim()) {
        newErrors.city = 'City is required';
      }

      if (!paymentData.state.trim()) {
        newErrors.state = 'State is required';
      }

      if (!paymentData.zipCode.trim()) {
        newErrors.zipCode = 'ZIP code is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Format card number input
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return '';
    }
  };

  // Format expiry date input
  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Create appointment first, then process payment
  const createAppointmentAndPayment = async (): Promise<{ appointmentId: string, success: boolean }> => {
    if (!bookingData || !doctor) return { appointmentId: '', success: false };

    try {
      // Ensure session is still valid before payment
      await authService.ensureValidSession();
      
      const currentUser = authService.getUser();
      if (!currentUser) {
        throw new Error('User session invalid');
      }

      // Calculate total amount
      const totalAmount = (doctor.consultationFee || 0) + (bookingData.urgent ? 500 : 0);

      // Prepare comprehensive appointment and payment data for the new endpoint
      const appointmentAndPaymentData = {
        doctor_id: bookingData.doctor_id,
        patient_name: currentUser.name || currentUser.email || 'Patient',
        patient_phone: bookingData.patient_phone,
        patient_email: bookingData.patient_email || currentUser.email,
        doctor_name: doctor.name,
        appointment_date: bookingData.appointment_date,
        reason: bookingData.reason,
        notes: bookingData.notes,
        consultation_type: bookingData.consultation_type,
        urgent: bookingData.urgent,
        preferred_language: bookingData.preferred_language,
        medical_history: bookingData.medical_history,
        report_complaint: bookingData.report_complaint,
        // Payment data
        amount: totalAmount,
        currency: 'INR',
        payment_method: paymentData.paymentMethod,
        payment_data: {
          method: paymentData.paymentMethod,
          card_last_four: paymentData.paymentMethod !== 'upi' ? paymentData.cardNumber.slice(-4) : null,
          upi_id: paymentData.paymentMethod === 'upi' ? paymentData.upiId : null,
          cardholder_name: paymentData.cardHolderName,
          billing_address: {
            address: paymentData.billingAddress,
            city: paymentData.city,
            state: paymentData.state,
            zip_code: paymentData.zipCode
          }
        }
      };

      console.log('Creating appointment with payment using new endpoint:', appointmentAndPaymentData);
      
      // Use the new comprehensive endpoint that handles both appointment and payment
      const response = await httpClient.post('/api/appointments/create-with-payment', appointmentAndPaymentData);

      console.log('Appointment and payment response:', response.data);

      if (!response.data.success || !response.data.appointment || !response.data.appointment.id) {
        throw new Error('Invalid response from server');
      }

      const appointment = response.data.appointment;
      const payment = response.data.payment;
      const appointmentId = appointment.id;

      // Check if payment was successful
      const paymentSuccess = payment && payment.status === 'completed';

      if (paymentSuccess) {
        // Store appointment info for potential feedback later
        localStorage.setItem('feedbackAppointment', JSON.stringify({
          id: appointmentId,
          doctor_name: doctor.name,
          specialty: doctor.specialty,
          appointment_date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          profile_picture: doctor.profile_picture
        }));
      }

      return { appointmentId, success: paymentSuccess };

    } catch (error: any) {
      console.error('Error creating appointment and payment:', error);
      
      // More specific error handling
      if (error.response?.status === 404) {
        if (error.response.data?.error?.includes('Doctor not found')) {
          throw new Error('Selected doctor is not available. Please choose another doctor.');
        } else {
          throw new Error('Appointment could not be created. Please try again.');
        }
      } else if (error.response?.status === 400) {
        const errorMsg = error.response.data?.error || 'Invalid appointment data';
        throw new Error(errorMsg);
      } else if (error.message.includes('Session expired')) {
        throw new Error('Your session has expired. Please log in again and retry the booking.');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Failed to process booking and payment. Please check your connection and try again.');
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePayment()) {
      return;
    }

    // Check session validity before payment
    if (!sessionValidated || !authService.isAuthenticated()) {
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again.",
        variant: "destructive"
      });
      navigate('/login/patient');
      return;
    }

    setProcessing(true);
    setPaymentStep('processing');

    try {
      // Create appointment and process payment
      const { appointmentId, success } = await createAppointmentAndPayment();
      
      if (!success) {
        setPaymentStep('error');
        toast({
          title: "Payment Failed",
          description: "There was an issue processing your payment. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Show success animation
      setAppointmentId(appointmentId);
      setShowAnimation(true);
      setPaymentStep('success');

    } catch (error: any) {
      setPaymentStep('error');
      
      if (error.message.includes('Session expired') || error.message.includes('Authentication')) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again to complete your booking.",
          variant: "destructive"
        });
        navigate('/login/patient');
      } else {
        toast({
          title: "Booking Error",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  // Handle animation completion
  const handleAnimationComplete = () => {
    setShowAnimation(false);
    
    // Clear localStorage
    localStorage.removeItem('pendingBooking');
    localStorage.removeItem('doctorInfo');
    localStorage.removeItem('bookingFeedback');

    toast({
      title: "Booking Successful!",
      description: "Your appointment request has been sent to the doctor for approval.",
    });

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('/dashboard/patient');
    }, 1000);
  };

  // Render processing state
  if (paymentStep === 'processing') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-medical-blue mx-auto" />
                <h2 className="text-xl font-semibold">Processing Payment</h2>
                <p className="text-gray-600">Please wait while we process your payment and book your appointment...</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>✓ Validating payment information</p>
                  <p>⏳ Processing payment</p>
                  <p>⏳ Creating appointment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Render success state with animation
  if (paymentStep === 'success') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              {showAnimation ? (
                <PaymentSuccessAnimation onComplete={handleAnimationComplete} />
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  <h2 className="text-xl font-semibold text-green-800">Booking Successful!</h2>
                  <div className="space-y-2">
                    <p className="text-gray-600">Your appointment request has been sent to Dr. {doctor?.name}.</p>
                    <p className="text-sm text-gray-500">You will receive a notification once the doctor approves your request.</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-md text-sm">
                    <p className="font-medium text-green-800">What's next?</p>
                    <ul className="list-disc list-inside text-green-700 mt-2 space-y-1">
                      <li>Doctor will review your request</li>
                      <li>You'll get notified of approval</li>
                      <li>Join consultation from dashboard</li>
                    </ul>
                  </div>
                  <Button onClick={() => navigate('/dashboard/patient')} className="w-full">
                    Return to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Render error state
  if (paymentStep === 'error') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h2 className="text-xl font-semibold text-red-800">Payment Failed</h2>
                <p className="text-gray-600">There was an issue processing your payment. Please try again.</p>
                <div className="space-y-2">
                  <Button onClick={() => setPaymentStep('details')} className="w-full">
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard/patient')} className="w-full">
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!doctor || !bookingData || !sessionValidated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-medical-blue mx-auto" />
            <p className="text-gray-600">Validating session and loading checkout...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const appointmentDate = new Date(bookingData.appointment_date);
  const totalAmount = (doctor.consultationFee || 0) + (bookingData.urgent ? 500 : 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="flex items-center mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Secure Checkout</h1>
            <div className="ml-auto flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Session Protected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div className="order-2 lg:order-1">
              <Card>
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Doctor Info */}
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={doctor.profile_picture} alt={doctor.name} />
                      <AvatarFallback className="bg-medical-blue text-white">
                        {doctor.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">Dr. {doctor.name}</h3>
                      <p className="text-gray-600">{doctor.specialty}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Appointment Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date & Time:</span>
                      <span className="text-right">
                        {format(appointmentDate, 'EEEE, MMMM d, yyyy')}
                        <br />
                        {format(appointmentDate, 'h:mm a')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="flex items-center">
                        {bookingData.consultation_type === 'video' && <Video className="h-4 w-4 mr-1" />}
                        {bookingData.consultation_type === 'chat' && <MessageCircle className="h-4 w-4 mr-1" />}
                        {bookingData.consultation_type === 'phone' && <Phone className="h-4 w-4 mr-1" />}
                        {bookingData.consultation_type === 'video' ? 'Video Call' : 
                         bookingData.consultation_type === 'chat' ? 'Chat' : 'Phone Call'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Language:</span>
                      <span>{bookingData.preferred_language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reason:</span>
                      <span className="text-right max-w-xs">{bookingData.reason}</span>
                    </div>
                    {bookingData.urgent && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Priority:</span>
                        <Badge variant="destructive">Urgent</Badge>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Pricing */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation Fee:</span>
                      <span>₹{doctor.consultationFee}</span>
                    </div>
                    {bookingData.urgent && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Urgent Fee:</span>
                        <span>₹500</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span className="text-medical-blue">₹{totalAmount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Form */}
            <div className="order-1 lg:order-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lock className="h-5 w-5 mr-2" />
                      Payment Information
                    </CardTitle>
                    <CardDescription className="flex items-center">
                      <Shield className="h-4 w-4 mr-1" />
                      Your payment information is secure and encrypted
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Payment Method */}
                    <div>
                      <Label>Payment Method</Label>
                      <RadioGroup 
                        value={paymentData.paymentMethod} 
                        onValueChange={(value: 'credit' | 'debit' | 'upi') => 
                          setPaymentData(prev => ({ ...prev, paymentMethod: value }))
                        }
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="credit" id="credit" />
                          <Label htmlFor="credit" className="flex items-center cursor-pointer">
                            <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                            Credit Card
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="debit" id="debit" />
                          <Label htmlFor="debit" className="flex items-center cursor-pointer">
                            <CreditCard className="h-5 w-5 mr-2 text-green-600" />
                            Debit Card
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                          <RadioGroupItem value="upi" id="upi" />
                          <Label htmlFor="upi" className="flex items-center cursor-pointer">
                            <Smartphone className="h-5 w-5 mr-2 text-purple-600" />
                            UPI Payment
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* UPI Payment */}
                    {paymentData.paymentMethod === 'upi' && (
                      <div>
                        <Label htmlFor="upiId">UPI ID *</Label>
                        <Input
                          id="upiId"
                          placeholder="yourname@paytm"
                          value={paymentData.upiId}
                          onChange={(e) => setPaymentData(prev => ({ ...prev, upiId: e.target.value }))}
                          className={errors.upiId ? 'border-red-500' : ''}
                        />
                        {errors.upiId && (
                          <p className="text-red-500 text-xs mt-1">{errors.upiId}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Enter your UPI ID (e.g., yourname@paytm, yourname@gpay)
                        </p>
                      </div>
                    )}
                    
                    {/* Card Payment Details */}
                    {paymentData.paymentMethod !== 'upi' && (
                      <>
                        <div>
                          <Label htmlFor="cardHolderName">Cardholder Name *</Label>
                          <Input
                            id="cardHolderName"
                            placeholder="John Smith"
                            value={paymentData.cardHolderName}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, cardHolderName: e.target.value }))}
                            className={errors.cardHolderName ? 'border-red-500' : ''}
                          />
                          {errors.cardHolderName && (
                            <p className="text-red-500 text-xs mt-1">{errors.cardHolderName}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="cardNumber">Card Number *</Label>
                          <Input
                            id="cardNumber"
                            value={paymentData.cardNumber}
                            onChange={(e) => setPaymentData(prev => ({ 
                              ...prev, 
                              cardNumber: formatCardNumber(e.target.value) 
                            }))}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            className={errors.cardNumber ? 'border-red-500' : ''}
                          />
                          {errors.cardNumber && (
                            <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="expiryDate">Expiry Date *</Label>
                            <Input
                              id="expiryDate"
                              value={paymentData.expiryDate}
                              onChange={(e) => setPaymentData(prev => ({ 
                                ...prev, 
                                expiryDate: formatExpiryDate(e.target.value) 
                              }))}
                              placeholder="MM/YY"
                              maxLength={5}
                              className={errors.expiryDate ? 'border-red-500' : ''}
                            />
                            {errors.expiryDate && (
                              <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="cvv">CVV *</Label>
                            <Input
                              id="cvv"
                              value={paymentData.cvv}
                              onChange={(e) => setPaymentData(prev => ({ 
                                ...prev, 
                                cvv: e.target.value.replace(/\D/g, '') 
                              }))}
                              placeholder="123"
                              maxLength={4}
                              className={errors.cvv ? 'border-red-500' : ''}
                            />
                            {errors.cvv && (
                              <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>
                            )}
                          </div>
                        </div>

                        {/* Billing Address */}
                        <Separator />
                        <h4 className="font-medium">Billing Address</h4>
                        
                        <div>
                          <Label htmlFor="billingAddress">Address *</Label>
                          <Input
                            id="billingAddress"
                            placeholder="123 Main Street"
                            value={paymentData.billingAddress}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, billingAddress: e.target.value }))}
                            className={errors.billingAddress ? 'border-red-500' : ''}
                          />
                          {errors.billingAddress && (
                            <p className="text-red-500 text-xs mt-1">{errors.billingAddress}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="city">City *</Label>
                            <Input
                              id="city"
                              placeholder="New York"
                              value={paymentData.city}
                              onChange={(e) => setPaymentData(prev => ({ ...prev, city: e.target.value }))}
                              className={errors.city ? 'border-red-500' : ''}
                            />
                            {errors.city && (
                              <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="state">State *</Label>
                            <Input
                              id="state"
                              placeholder="NY"
                              value={paymentData.state}
                              onChange={(e) => setPaymentData(prev => ({ ...prev, state: e.target.value }))}
                              className={errors.state ? 'border-red-500' : ''}
                            />
                            {errors.state && (
                              <p className="text-red-500 text-xs mt-1">{errors.state}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="zipCode">ZIP Code *</Label>
                          <Input
                            id="zipCode"
                            placeholder="10001"
                            value={paymentData.zipCode}
                            onChange={(e) => setPaymentData(prev => ({ 
                              ...prev, 
                              zipCode: e.target.value.replace(/\D/g, '') 
                            }))}
                            maxLength={10}
                            className={errors.zipCode ? 'border-red-500' : ''}
                          />
                          {errors.zipCode && (
                            <p className="text-red-500 text-xs mt-1">{errors.zipCode}</p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  type="submit" 
                  className="w-full bg-medical-blue hover:bg-medical-blue/90 text-white py-3"
                  disabled={processing || !sessionValidated}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {paymentData.paymentMethod === 'upi' ? (
                        <Smartphone className="h-4 w-4 mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Pay ₹{totalAmount} & Book Appointment
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  By completing this purchase, you agree to our terms of service.
                  Your payment will be held securely until the consultation is completed.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CheckoutPage; 