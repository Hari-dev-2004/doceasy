import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, MessageCircle, Phone, Star, AlertTriangle, CreditCard, ArrowLeft, Info, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addDays, isBefore, startOfDay, setHours, setMinutes, isToday, differenceInMinutes } from "date-fns";
import axios from 'axios';
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { API_URL } from "@/config";

interface Doctor {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  specialty: string;
  experience_years?: number;
  consultationFee?: number;
  bio?: string;
  verificationStatus: string;
  profile_picture?: string;
  isAvailable?: boolean;
  qualifications?: string[];
  languages?: string[];
  rating?: number;
  reviewCount?: number;
}

interface BookingData {
  doctor_id: string;
  appointment_date: string;
  consultation_type: 'video' | 'phone';
  reason: string;
  notes: string;
  urgent: boolean;
  patient_email: string;
  preferred_language: string;
  medical_history: string;
}

const BookConsultation = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Doctor data
  const [doctor, setDoctor] = useState<Doctor | null>(null);

  // Form data
  const [bookingData, setBookingData] = useState<BookingData>({
    doctor_id: doctorId || '',
    appointment_date: '',
    consultation_type: 'video',
    reason: '',
    notes: '',
    urgent: false,
    patient_email: '',
    preferred_language: 'English',
    medical_history: ''
  });

  // Calendar and time selection
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('details');

  // Generate available time slots (9 AM to 5 PM) - DEPRECATED, now using API
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  // Fetch available slots for a specific date
  const fetchAvailableSlots = async (date: Date) => {
    if (!doctorId) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    const isTodaySelected = isToday(date);
    setLoadingSlots(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctors/${doctorId}/availability/date/${dateString}`);
      const data = response.data;
      
      if (data.success) {
        setAvailableSlots(data.available_slots || []);
        
        // Extract available time slots for backward compatibility
        const availableTimes = data.available_slots
          .filter((slot: any) => slot.is_available && !slot.is_past)
          .map((slot: any) => slot.time);
        setAvailableTimes(availableTimes);
        
        console.log(`Fetched slots for ${dateString}:`, {
          total_slots: data.available_slots?.length || 0,
          available_slots: availableTimes.length,
          booked_slots: data.booked_count || 0,
          is_today: isTodaySelected
        });
        
        // Show specific message for same-day bookings
        if (isTodaySelected && data.available_slots && data.available_slots.length === 0) {
          toast({
            title: "No slots available today",
            description: "The doctor has no availability set for today. Please try another date.",
            variant: "default"
          });
        } else if (isTodaySelected && availableTimes.length === 0 && data.available_slots && data.available_slots.length > 0) {
          toast({
            title: "No future slots available today",
            description: "All remaining slots for today have either passed or are already booked. Please try tomorrow.",
            variant: "default"
          });
        }
        
      } else {
        console.error('Failed to fetch slots:', data.error);
        setAvailableSlots([]);
        setAvailableTimes([]);
        
        if (isTodaySelected) {
          toast({
            title: "Unable to load today's slots",
            description: data.error || "Please try refreshing or select another date.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Unable to load time slots",
            description: data.error || "Please try refreshing or select another date.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
      setAvailableTimes([]);
      
      const errorMessage = isTodaySelected 
        ? "Failed to load today's available time slots. Please try refreshing the page."
        : "Failed to load available time slots. Please try refreshing the page.";
      
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoadingSlots(false);
    }
  };

  // Debug function to check slot booking status
  const debugSlots = async (date: Date) => {
    if (!doctorId) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctors/${doctorId}/slots/debug?date=${dateString}`);
      console.log('Debug slot information:', response.data);
      
      toast({
        title: "Debug Info",
        description: `Check console for detailed slot information`,
      });
    } catch (error) {
      console.error('Error fetching debug info:', error);
    }
  };

  // Debug function to validate slot booking
  const validateSlotBooking = async (slotDatetime: string) => {
    if (!doctorId) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/doctors/${doctorId}/slots/validate`, {
        slot_datetime: slotDatetime
      });
      
      console.log('Slot validation debug info:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error validating slot:', error);
      return null;
    }
  };

  // Check slot availability in real-time
  const checkSlotAvailability = async (slotDatetime: string) => {
    if (!doctorId) {
      return { isAvailable: false, isBooked: true, message: 'Doctor ID not available' };
    }
    
    try {
      const response = await axios.post(`${API_URL}/api/doctors/${doctorId}/slots/check`, {
        slot_datetime: slotDatetime
      });
      
      const data = response.data;
      console.log('Slot availability check:', data);
      
      return {
        isAvailable: data.is_available && !data.is_booked,
        isBooked: data.is_booked,
        message: data.message,
        debugInfo: data.debug_info
      };
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return { isAvailable: false, isBooked: true, message: 'Error checking availability' };
    }
  };

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to book a consultation",
          variant: "destructive"
        });
        navigate('/login/patient');
        return;
      }
      
      // Try to parse user data
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role !== 'patient') {
            toast({
              title: "Access Denied",
              description: "Only patients can book consultations",
              variant: "destructive"
            });
            navigate('/');
            return;
          }
          
          // Pre-fill user data
          setBookingData(prev => ({
            ...prev,
            patient_email: user.email || ''
          }));
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
      
      fetchDoctorDetails();
    };
    
    checkAuth();
  }, [doctorId, navigate, toast]);

  // Fetch doctor details
  const fetchDoctorDetails = async () => {
    if (!doctorId) {
      toast({
        title: "Invalid Doctor",
        description: "No doctor ID provided",
        variant: "destructive"
      });
      navigate('/dashboard/patient');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/doctors`);
      const doctorsData = response.data;
      
      const selectedDoctor = doctorsData.find((doc: any) => doc.id === doctorId);
      
      if (!selectedDoctor) {
        toast({
          title: "Doctor Not Found",
          description: "The selected doctor could not be found",
          variant: "destructive"
        });
        navigate('/dashboard/patient');
        return;
      }

      // Format doctor data
      const doctorInfo: Doctor = {
        id: selectedDoctor.id,
        name: selectedDoctor.name || `${selectedDoctor.first_name || ''} ${selectedDoctor.last_name || ''}`.trim(),
        first_name: selectedDoctor.first_name,
        last_name: selectedDoctor.last_name,
        specialty: selectedDoctor.specialty || 'General Practitioner',
        experience_years: selectedDoctor.experience_years || selectedDoctor.experienceYears,
        consultationFee: selectedDoctor.consultationFee || 1500,
        bio: selectedDoctor.bio || '',
        verificationStatus: selectedDoctor.verificationStatus,
        profile_picture: selectedDoctor.profile_picture,
        isAvailable: selectedDoctor.verificationStatus === 'approved',
        qualifications: selectedDoctor.qualifications || [],
        languages: selectedDoctor.languages || ['English'],
        rating: selectedDoctor.rating || 4.5,
        reviewCount: selectedDoctor.reviewCount || 0
      };

      setDoctor(doctorInfo);
      setBookingData(prev => ({
        ...prev,
        doctor_id: doctorInfo.id
      }));

      // Generate available time slots
      setAvailableTimes(generateTimeSlots());

    } catch (error) {
      console.error('Error fetching doctor details:', error);
      toast({
        title: "Failed to Load Doctor",
        description: "Could not retrieve doctor information",
        variant: "destructive"
      });
      navigate('/dashboard/patient');
    } finally {
      setLoading(false);
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(''); // Reset time when date changes
    
    // Fetch available slots for the selected date
    fetchAvailableSlots(date);
  };

  // Handle time selection with real-time validation
  const handleTimeSelect = async (time: string, slot?: any) => {
    if (selectedDate) {
      // Fix timezone issue by constructing datetime string manually
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const slotDatetime = `${dateString}T${time}:00`;
      
      // Check if the selected time is at least 1 hour in advance for same-day bookings - REMOVING THIS RESTRICTION
      const now = new Date();
      const selectedDateTime = new Date(slotDatetime);
      const isToday = format(now, 'yyyy-MM-dd') === format(selectedDateTime, 'yyyy-MM-dd');
      
      // If we have slot data from the initial fetch, check its status first
      if (slot) {
        if (slot.is_past) {
          toast({
            title: "Cannot Select Past Slot",
            description: "This time slot has already passed. Please choose a future time.",
            variant: "destructive"
          });
          return;
        }
        
        if (!slot.is_available || slot.status === 'booked') {
          toast({
            title: "Slot Not Available",
            description: "This time slot is already booked by another patient. Please choose a different time.",
            variant: "destructive"
          });
          return;
        }
      }
      
      // Perform real-time validation
      const availabilityCheck = await checkSlotAvailability(slotDatetime);
      
      if (!availabilityCheck.isAvailable) {
        // Get detailed validation info for debugging
        console.log('Slot validation failed, getting detailed debug info...');
        const debugInfo = await validateSlotBooking(slotDatetime);
        
        if (availabilityCheck.isBooked) {
          toast({
            title: "Slot Already Booked",
            description: "This time slot was just booked by another patient. Please refresh and choose another time.",
            variant: "destructive"
          });
          
          // Refresh slots to show current availability
          if (selectedDate) {
            console.log('Refreshing slots after booking conflict...');
            await fetchAvailableSlots(selectedDate);
          }
        } else {
          // Check if the issue is availability window or other validation problem
          let errorMessage = availabilityCheck.message || "This time slot is not available.";
          let suggestionMessage = "Please choose a different time.";
          
          // Handle specific error cases
          if (availabilityCheck.message && availabilityCheck.message.includes("outside doctor's availability")) {
            errorMessage = "This time is outside the doctor's available hours.";
            suggestionMessage = "Please select a time within the doctor's working hours.";
          } else if (availabilityCheck.message && availabilityCheck.message.includes("not available on this day")) {
            errorMessage = "The doctor is not available on this day.";
            suggestionMessage = "Please select a different date.";
          }
          
          toast({
            title: "Slot Not Available",
            description: `${errorMessage} ${suggestionMessage}`,
            variant: "destructive"
          });
        }
        
        // Log debug info for troubleshooting
        if (debugInfo) {
          console.log('Detailed validation info:', debugInfo);
          console.log('Backend availability check:', availabilityCheck);
        }
        
        return;
      }
      
      // Slot is available - proceed with selection
      console.log('Slot validation successful, proceeding with selection...');
      setSelectedTime(time);
      
      // Update booking data
      setBookingData(prev => ({
        ...prev,
        appointment_date: slotDatetime
      }));
      
      // Show success feedback
      toast({
        title: "Time Slot Selected",
        description: `Selected ${time} on ${format(selectedDate, 'EEEE, MMMM d')}`,
        variant: "default"
      });
      
      console.log('Slot selected successfully:', { 
        time, 
        date: format(selectedDate, 'yyyy-MM-dd'), 
        datetime: slotDatetime,
        validation_passed: true
      });
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Incomplete Information",
        description: "Please select both date and time for your appointment",
        variant: "destructive"
      });
      return;
    }

    if (!bookingData.reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for your consultation",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      // Store booking data in localStorage for checkout page
      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      localStorage.setItem('doctorInfo', JSON.stringify(doctor));

      toast({
        title: "Proceeding to Checkout",
        description: "Redirecting to payment page...",
      });

      // Redirect to checkout page
      navigate('/checkout');

    } catch (error) {
      console.error('Error preparing booking:', error);
      toast({
        title: "Booking Error",
        description: "Failed to prepare booking. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Generate date options (next 30 days, including today if time slots are available)
  const getAvailableDates = () => {
    const dates = [];
    let currentDate = new Date(); // Start from today
    
    for (let i = 0; i < 30; i++) {
      const date = addDays(currentDate, i);
      // Include all days - let the backend filter availability
      // This allows doctors to set weekend availability if needed
      dates.push(date);
    }
    return dates;
  };

  const availableDates = getAvailableDates();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue mx-auto" />
          <p className="mt-4 text-gray-600">Loading doctor information...</p>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Doctor Not Found</h2>
          <p className="text-gray-600 mb-4">The selected doctor could not be found.</p>
          <Link to="/dashboard/patient">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar simplified />
      
      <div className="container max-w-6xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link to="/dashboard/patient">
            <Button variant="outline" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold">Book Consultation</h1>
            <p className="text-gray-600">Schedule your appointment with Dr. {doctor.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Doctor Info Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={doctor.profile_picture} alt={doctor.name} />
                    <AvatarFallback className="bg-medical-blue text-white text-lg">
                      {doctor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">Dr. {doctor.name}</CardTitle>
                    <CardDescription className="text-base">
                      {doctor.specialty}
                      {doctor.experience_years && ` • ${doctor.experience_years}+ years`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rating */}
                <div className="flex items-center">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= (doctor.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    {doctor.rating?.toFixed(1)} ({doctor.reviewCount || 0} reviews)
                  </span>
                </div>

                <Separator />

                {/* Consultation Fee */}
                <div className="text-center py-4 bg-medical-blue/5 rounded-lg">
                  <div className="text-2xl font-bold text-medical-blue">
                    ₹{doctor.consultationFee || 1500}
                  </div>
                  <div className="text-sm text-gray-600">Consultation Fee</div>
                </div>

                {/* Quick Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Verified:</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Languages:</span>
                    <span>{doctor.languages?.join(', ') || 'English'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Response Time:</span>
                    <span>Within 2 hours</span>
                  </div>
                </div>

                {doctor.bio && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">About</h4>
                      <p className="text-sm text-gray-600">{doctor.bio}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Book Your Consultation</CardTitle>
                <CardDescription>
                  Fill in the details below to schedule your appointment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                    <TabsTrigger value="type">Type</TabsTrigger>
                    <TabsTrigger value="review">Review</TabsTrigger>
                  </TabsList>

                  {/* Step 1: Basic Details */}
                  <TabsContent value="details" className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reason">Reason for Consultation *</Label>
                        <Textarea
                          id="reason"
                          placeholder="Please describe your symptoms or health concerns..."
                          value={bookingData.reason}
                          onChange={(e) => setBookingData(prev => ({ ...prev, reason: e.target.value }))}
                          className="mt-1"
                          rows={4}
                        />
                      </div>

                      <div>
                        <Label htmlFor="medical_history">Medical History</Label>
                        <Textarea
                          id="medical_history"
                          placeholder="Any relevant medical history, current medications, allergies..."
                          value={bookingData.medical_history}
                          onChange={(e) => setBookingData(prev => ({ ...prev, medical_history: e.target.value }))}
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="patient_email">Email Address</Label>
                        <Input
                          id="patient_email"
                          type="email"
                          value={bookingData.patient_email}
                          onChange={(e) => setBookingData(prev => ({ ...prev, patient_email: e.target.value }))}
                          className="mt-1"
                          disabled
                        />
                      </div>

                      <div>
                        <Label htmlFor="preferred_language">Preferred Language</Label>
                        <Select 
                          value={bookingData.preferred_language} 
                          onValueChange={(value) => setBookingData(prev => ({ ...prev, preferred_language: value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Spanish">Spanish</SelectItem>
                            <SelectItem value="French">French</SelectItem>
                            <SelectItem value="German">German</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="urgent"
                          checked={bookingData.urgent}
                          onCheckedChange={(checked) => setBookingData(prev => ({ ...prev, urgent: !!checked }))}
                        />
                        <Label htmlFor="urgent" className="text-sm">
                          This is an urgent consultation (additional ₹500 fee)
                        </Label>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={() => setActiveTab('schedule')}>
                          Next: Schedule
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Step 2: Schedule */}
                  <TabsContent value="schedule" className="space-y-6">
                    <div className="space-y-6">
                      <div>
                        <Label className="text-base font-medium">Select Date</Label>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                          {availableDates.slice(0, 15).map((date) => (
                            <Button
                              key={date.toISOString()}
                              variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                              size="sm"
                              className="p-3 h-auto flex flex-col"
                              onClick={() => handleDateSelect(date)}
                            >
                              <div className="text-xs">{format(date, 'EEE')}</div>
                              <div className="font-semibold">{format(date, 'd')}</div>
                              <div className="text-xs">{format(date, 'MMM')}</div>
                            </Button>
                          ))}
                        </div>
                      </div>

                      {selectedDate && (
                        <div>
                          <Label className="text-base font-medium">
                            Available Times for {format(selectedDate, 'EEEE, MMMM d')}
                          </Label>
                          
                          {loadingSlots ? (
                            <div className="flex justify-center items-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-medical-blue" />
                              <span className="ml-2 text-sm text-gray-600">Loading available slots...</span>
                            </div>
                          ) : availableSlots.length > 0 ? (
                            <>
                              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                                {availableSlots.map((slot) => {
                                  const isSelected = selectedTime === slot.time;
                                  const now = new Date();
                                  const slotDateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slot.time}:00`);
                                  const isPast = isBefore(slotDateTime, now);
                                  const isBooked = slot.status === 'booked';
                                  const isTodaySelected = isToday(selectedDate);
                                  
                                  // Remove the isWithinOneHour check - allow immediate booking
                                  const isDisabled = isPast || isBooked;
                                  
                                  const buttonStyle = isSelected
                                    ? 'bg-medical-blue text-white hover:bg-medical-blue/90'
                                    : isDisabled
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'hover:bg-medical-blue/10 hover:text-medical-blue';
                                  
                                  const buttonText = slot.time;
                                  
                                  return (
                                    <Button
                                      key={slot.time}
                                      variant="outline"
                                      size="sm"
                                      className={`${buttonStyle} h-10 text-sm font-medium transition-all`}
                                      onClick={() => !isDisabled && handleTimeSelect(slot.time, slot)}
                                      disabled={isDisabled}
                                      title={
                                        isPast ? 'This time slot has passed' :
                                        isBooked ? 'This slot is already booked' :
                                        isTodaySelected ? `Book appointment for today at ${slot.time}` :
                                        `Book appointment for ${format(selectedDate, 'MMM d')} at ${slot.time}`
                                      }
                                    >
                                      <div className="flex flex-col items-center">
                                        <span>{buttonText}</span>
                                        {isPast && (
                                          <span className="text-xs opacity-75">Past</span>
                                        )}
                                        {isBooked && !isPast && (
                                          <span className="text-xs opacity-75">Booked</span>
                                        )}
                                        {!isPast && !isBooked && isTodaySelected && (
                                          <span className="text-xs opacity-75">Today</span>
                                        )}
                                      </div>
                                    </Button>
                                  );
                                })}
                              </div>
                              
                              {availableSlots.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selectedDate && fetchAvailableSlots(selectedDate)}
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Refresh Slots
                                  </Button>
                                  
                                  {selectedDate && isToday(selectedDate) && (
                                    <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-md">
                                      <Clock className="h-4 w-4 mr-1" />
                                      Instant booking available
                                    </div>
                                  )}
                                  
                                  {/* Debug button for development */}
                                  {process.env.NODE_ENV === 'development' && selectedTime && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        if (selectedDate && selectedTime) {
                                          const [hours, minutes] = selectedTime.split(':').map(Number);
                                          const appointmentDateTime = setMinutes(setHours(selectedDate, hours), minutes);
                                          const slotDatetime = appointmentDateTime.toISOString();
                                          
                                          const debugInfo = await validateSlotBooking(slotDatetime);
                                          
                                          toast({
                                            title: "Debug Info (Check Console)",
                                            description: `Validation result: ${debugInfo?.validation_results?.final_status || 'unknown'}`,
                                            variant: "default"
                                          });
                                        }
                                      }}
                                      className="text-gray-600 border-gray-200 hover:bg-gray-50"
                                    >
                                      Debug Selected Slot
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-4 mt-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                                  <span>Available</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                                  <span>Booked</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                                  <span>Past</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                  <span>Selected</span>
                                </div>
                              </div>
                              
                              {selectedDate && isToday(selectedDate) && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                  <div className="flex items-start">
                                    <Info className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                      <p className="font-medium">Same-Day Booking Available</p>
                                      <p className="text-xs mt-1">
                                        You can book appointments for today! Instant booking is now available. Past time slots are automatically hidden.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                                <div className="flex items-start">
                                  <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                                  <div className="text-sm text-green-800">
                                    <p className="font-medium">Real-time Availability</p>
                                    <p className="text-xs mt-1">
                                      Slots are updated in real-time. If a slot becomes unavailable after selection, 
                                      you'll be notified to choose another time.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {selectedDate && isToday(selectedDate) 
                                  ? "No slots available for today"
                                  : "No availability"
                                }
                              </h3>
                              <p className="text-gray-600 mb-4">
                                {selectedDate && isToday(selectedDate) 
                                  ? "Either the doctor has no availability set for today, or all remaining slots have passed or been booked."
                                  : `Dr. ${doctor?.name} is not available on ${format(selectedDate, 'EEEE, MMMM d')}.`
                                }
                              </p>
                              <div className="space-y-2 text-sm text-gray-500">
                                {selectedDate && isToday(selectedDate) ? (
                                  <>
                                    <p>• Try selecting tomorrow or another future date</p>
                                    <p>• Same-day bookings require at least 1 hour advance notice</p>
                                    <p>• Refresh the page if you think this is an error</p>
                                  </>
                                ) : (
                                  <>
                                    <p>• Try selecting a different date</p>
                                    <p>• The doctor may have limited availability on certain days</p>
                                    <p>• Contact the clinic directly if you need urgent care</p>
                                  </>
                                )}
                              </div>
                              
                              <Button
                                variant="outline"
                                onClick={() => selectedDate && fetchAvailableSlots(selectedDate)}
                                className="mt-4"
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Try Again
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setActiveTab('details')}>
                          Previous
                        </Button>
                        <Button 
                          onClick={() => setActiveTab('type')}
                          disabled={!selectedDate || !selectedTime}
                        >
                          Next: Consultation Type
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Step 3: Consultation Type */}
                  <TabsContent value="type" className="space-y-6">
                    <div className="space-y-6">
                      <div>
                        <Label className="text-base font-medium">Consultation Type</Label>
                        <RadioGroup
                          value={bookingData.consultation_type}
                          onValueChange={(value: 'video' | 'phone') => 
                            setBookingData(prev => ({ ...prev, consultation_type: value }))}
                          className="mt-3"
                        >
                          <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                            <RadioGroupItem value="video" id="video" />
                            <Label htmlFor="video" className="flex items-center cursor-pointer flex-1">
                              <Video className="h-5 w-5 mr-3 text-medical-blue" />
                              <div>
                                <div className="font-medium">Video Call</div>
                                <div className="text-sm text-gray-600">Face-to-face consultation via video</div>
                              </div>
                            </Label>
                          </div>

                          <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                            <RadioGroupItem value="phone" id="phone" />
                            <Label htmlFor="phone" className="flex items-center cursor-pointer flex-1">
                              <Phone className="h-5 w-5 mr-3 text-medical-blue" />
                              <div>
                                <div className="font-medium">Phone Call</div>
                                <div className="text-sm text-gray-600">Voice-only consultation</div>
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div>
                        <Label htmlFor="notes">Additional Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Any additional information or specific requests..."
                          value={bookingData.notes}
                          onChange={(e) => setBookingData(prev => ({ ...prev, notes: e.target.value }))}
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setActiveTab('schedule')}>
                          Previous
                        </Button>
                        <Button onClick={() => setActiveTab('review')}>
                          Review & Pay
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Step 4: Review & Payment */}
                  <TabsContent value="review" className="space-y-6">
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="font-semibold mb-4">Booking Summary</h3>
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Doctor:</span>
                            <span>Dr. {doctor.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Specialty:</span>
                            <span>{doctor.specialty}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Date & Time:</span>
                            <span>
                              {selectedDate && selectedTime 
                                ? `${format(selectedDate, 'EEEE, MMMM d')} at ${selectedTime}`
                                : 'Not selected'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Consultation Type:</span>
                            <span className="flex items-center">
                              {bookingData.consultation_type === 'video' ? (
                                <>
                                  <Video className="h-4 w-4 mr-1" />
                                  Video Call
                                </>
                              ) : (
                                <>
                                  <Phone className="h-4 w-4 mr-1" />
                                  Phone Call
                                </>
                              )}
                            </span>
                          </div>
                          
                          <Separator />
                          
                          <div className="flex justify-between">
                            <span className="text-gray-600">Consultation Fee:</span>
                            <span>₹{doctor.consultationFee || 1500}</span>
                          </div>
                          {bookingData.urgent && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Urgent Fee:</span>
                              <span>₹500</span>
                            </div>
                          )}
                          
                          <Separator />
                          
                          <div className="flex justify-between font-semibold">
                            <span>Total:</span>
                            <span>₹{(doctor.consultationFee || 1500) + (bookingData.urgent ? 500 : 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-start">
                          <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Important Information:</p>
                            <ul className="space-y-1 text-xs">
                              <li>• Your appointment request will be sent to the doctor for approval</li>
                              <li>• You will receive a confirmation email once approved</li>
                              <li>• Payment will be processed only after doctor confirmation</li>
                              <li>• You can reschedule or cancel up to 24 hours before your appointment</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setActiveTab('type')}>
                          Previous
                        </Button>
                        <Button 
                          onClick={handleSubmit}
                          disabled={submitting || !selectedDate || !selectedTime || !bookingData.reason.trim()}
                          className="bg-medical-blue hover:bg-medical-blue/90"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Proceed to Payment
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BookConsultation; 