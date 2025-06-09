import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Clock, Video, CreditCard, Star, LogOut, Loader2, RefreshCw, AlertCircle, Camera, Upload, Edit, Save, User, MessageCircle, Phone, Menu, Home } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from 'axios';
import AppointmentNotification from '@/components/AppointmentNotification';
import { API_URL } from "@/config";

// Using relative API paths with Vite proxy
// const API_URL = '';

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
}

interface Appointment {
  id: string;
  doctor_id: string;
  doctor_name: string;
  patient_id: string;
  patient_name: string;
  appointment_date: string;
  status: string;
  reason?: string;
  notes?: string;
  rejection_reason?: string;
  video_call_id?: string;
  consultation_type?: string;
  call_url?: string;
  chat_url?: string;
  patient_phone?: string;
}

interface Payment {
  id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  amount: number;
  currency: string;
  payment_method: string; // credit, debit, upi
  payment_type: string; // consultation, urgent_fee, etc.
  status: string; // pending, processing, completed, failed, refunded
  payment_status: string; // hold, approved, released, cancelled
  transaction_id: string;
  created_at: string;
  updated_at: string;
}

interface PatientPaymentStats {
  totalSpent: number;
  refundedAmount: number;
  completedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
}

interface PatientProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  consultations: number;
  lastVisit?: string;
  status: string;
  profile_picture?: string;
}

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("doctors");
  const [appointmentFilter, setAppointmentFilter] = useState("all");
  
  // Data state
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    completedSessions: 0,
    profileCompletion: 0
  });
  const [paymentStats, setPaymentStats] = useState<PatientPaymentStats>({
    totalSpent: 0,
    refundedAmount: 0,
    completedPayments: 0,
    pendingPayments: 0,
    refundedPayments: 0
  });
  
  // Loading states
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState<any>({});
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(true);

  // Function to handle joining consultations based on type
  const handleJoinConsultation = (appointment: Appointment) => {
    // Navigate directly to VideoCall page with the appointment ID
    // This will ensure patient and doctor join the same meeting room
    navigate(`/video-call/${appointment.id}`);
  };
  
  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access your dashboard",
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
              description: "This dashboard is for patients only",
              variant: "destructive"
            });
            navigate('/');
            return;
          }
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
      
      // Load all data
      loadDashboardData();
    };
    
    checkAuth();
  }, [navigate, toast]);
  
  // Load all dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPatientProfile(),
        fetchDoctors(),
        fetchAppointments(),
        fetchPayments()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Failed to load dashboard",
        description: "Some data may not be available. Please try refreshing.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Refresh all data
  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
      toast({
        title: "Dashboard refreshed",
        description: "All data has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not refresh dashboard data.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };
  
  // Fetch patient profile
  const fetchPatientProfile = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/patient/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPatientProfile(response.data);
      
      // Calculate profile completion
      const profile = response.data;
      let completion = 0;
      if (profile) {
      const fields = ['name', 'email', 'phone', 'gender', 'dateOfBirth'];
        const filledFields = fields.filter(field => profile[field] && profile[field].toString().trim() !== '');
      completion = (filledFields.length / fields.length) * 100;
      }
      
      setStats(prev => ({ ...prev, profileCompletion: completion }));
    } catch (err: any) {
      console.error('Error fetching patient profile:', err);
      
      // If profile endpoint doesn't exist, try to get profile from local storage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setPatientProfile({
            id: user.id || 'unknown',
            name: user.name || user.email || 'Patient',
            email: user.email || '',
            phone: '',
            gender: '',
            dateOfBirth: '',
            consultations: 0,
            status: 'active'
          });
        } catch (e) {
          console.error('Failed to parse user data:', e);
          // Set a minimal profile to prevent null reference errors
          setPatientProfile({
            id: 'unknown',
            name: 'Patient',
            email: '',
            phone: '',
            gender: '',
            dateOfBirth: '',
            consultations: 0,
            status: 'active'
          });
        }
      }
    }
  };
  
  // Fetch available doctors
  const fetchDoctors = async () => {
    setDoctorsLoading(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctors`);
      
      // Handle different possible response structures
      let doctorsArray = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          doctorsArray = response.data;
        } else if (response.data.doctors && Array.isArray(response.data.doctors)) {
          doctorsArray = response.data.doctors;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          doctorsArray = response.data.data;
        }
      }
      
      // Map the doctor data to expected format
      const doctorsData = doctorsArray.map((doctor: any) => ({
        id: doctor.id,
        name: doctor.name || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim(),
        first_name: doctor.first_name,
        last_name: doctor.last_name,
        specialty: doctor.specialty || 'General Practitioner',
        experience_years: doctor.experience_years || doctor.experienceYears,
        consultationFee: doctor.consultationFee || 1500,
        bio: doctor.bio || '',
        verificationStatus: doctor.verificationStatus,
        profile_picture: doctor.profile_picture,
        isAvailable: doctor.verificationStatus === 'approved'
      }));
      
      setDoctors(doctorsData);
    } catch (err) {
      console.error('Error fetching doctors:', err);
      // Set empty array on error to prevent filter errors
      setDoctors([]);
      toast({
        title: "Failed to load doctors",
        description: "Could not retrieve available doctors.",
        variant: "destructive"
      });
    } finally {
      setDoctorsLoading(false);
    }
  };
  
  // Fetch appointments
  const fetchAppointments = async () => {
    setAppointmentsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/patient/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle different possible response structures
      let appointmentsData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          appointmentsData = response.data;
        } else if (response.data.appointments && Array.isArray(response.data.appointments)) {
          appointmentsData = response.data.appointments;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          appointmentsData = response.data.data;
        }
      }
      
      setAppointments(appointmentsData);
      
      // Calculate stats
      const now = new Date();
      const upcoming = appointmentsData.filter((apt: Appointment) => 
        new Date(apt.appointment_date) > now && apt.status !== 'cancelled'
      ).length;
      const completed = appointmentsData.filter((apt: Appointment) => 
        apt.status === 'completed'
      ).length;
      
      setStats(prev => ({
        ...prev,
        upcomingAppointments: upcoming,
        completedSessions: completed
      }));
    } catch (err) {
      console.error('Error fetching appointments:', err);
      // Set empty array on error to prevent filter errors
        setAppointments([]);
        toast({
          title: "Failed to load appointments",
          description: "Could not retrieve your appointments.",
          variant: "destructive"
        });
    } finally {
      setAppointmentsLoading(false);
    }
  };
  
  // Fetch payment data
  const fetchPayments = async () => {
    setPaymentsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const user = localStorage.getItem('user');
      let userId = '';
      
      if (user) {
        const userData = JSON.parse(user);
        userId = userData.id;
      }
      
      const response = await axios.get(`${API_URL}/api/payments/patient/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Debug log to see response structure
      console.log('Payment API response:', response.data);
      
      let paymentsData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          paymentsData = response.data;
        } else if (Array.isArray(response.data.payments)) {
          paymentsData = response.data.payments;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          paymentsData = response.data.data;
        }
      }
      
      console.log('Processed payments data:', paymentsData);
      setPayments(paymentsData);
      calculatePaymentStats(paymentsData);
      
    } catch (err) {
      console.error('Error fetching payments:', err);
      // Set empty array on error to prevent filter errors
      setPayments([]);
      
      // Try alternative endpoint if first one fails
      try {
        const user = localStorage.getItem('user');
        let userId = '';
        
        if (user) {
          const userData = JSON.parse(user);
          userId = userData.id;
        }
        
        // Try with a different URL pattern if the first one failed
        const response = await axios.get(`${API_URL}/api/payments/patient/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Debug log for alternative endpoint
        console.log('Alternative payment API response:', response.data);
        
        let paymentsData = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            paymentsData = response.data;
          } else if (Array.isArray(response.data.payments)) {
            paymentsData = response.data.payments;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            paymentsData = response.data.data;
          }
        }
        
        console.log('Processed alternative payments data:', paymentsData);
        setPayments(paymentsData);
        calculatePaymentStats(paymentsData);
      } catch (secondErr) {
        console.error('Error fetching payments from alternative path:', secondErr);
        toast({
          title: "Failed to load payment history",
          description: "Could not retrieve your payment history.",
          variant: "destructive"
        });
      }
    } finally {
      setPaymentsLoading(false);
    }
  };
  
  // Calculate payment statistics
  const calculatePaymentStats = (paymentsData: Payment[]) => {
    if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
      setPaymentStats({
        totalSpent: 0,
        refundedAmount: 0,
        completedPayments: 0,
        pendingPayments: 0,
        refundedPayments: 0
      });
      return;
    }
    
    let totalSpent = 0;
    let refundedAmount = 0;
    let completedPayments = 0;
    let pendingPayments = 0;
    let refundedPayments = 0;
    
    paymentsData.forEach(payment => {
      // Handle case when amount might be a string
      const amount = typeof payment.amount === 'string' 
        ? parseFloat(payment.amount) 
        : payment.amount || 0;
      
      if (payment.status === 'completed') {
        totalSpent += amount;
        completedPayments++;
      } else if (payment.status === 'refunded') {
        refundedAmount += amount;
        refundedPayments++;
      } else if (payment.status === 'pending' || payment.status === 'processing') {
        pendingPayments++;
      }
    });
    
    setPaymentStats({
      totalSpent,
      refundedAmount,
      completedPayments,
      pendingPayments,
      refundedPayments
    });
  };
  
  const handleUpcomingAppointmentsClick = () => {
    setActiveTab("appointments");
    setAppointmentFilter("upcoming");
  };
  
  const handleCompletedSessionsClick = () => {
    setActiveTab("appointments");
    setAppointmentFilter("completed");
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account."
    });
    navigate('/');
  };

  // Profile photo handling
  const handleProfilePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a valid image file.",
          variant: "destructive"
        });
        return;
      }
      
      setProfilePhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleProfileFormChange = (field: string, value: string) => {
    setProfileFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const saveProfileChanges = async () => {
    setSavingProfile(true);
    const token = localStorage.getItem('token');
    
    try {
      const formData = new FormData();
      
      // Add text fields
      Object.keys(profileFormData).forEach(key => {
        if (profileFormData[key]) {
          formData.append(key, profileFormData[key]);
        }
      });
      
      // Add profile photo if selected
      if (profilePhoto) {
        formData.append('profile_picture', profilePhoto);
      }
      
      await axios.put(`${API_URL}/api/patient/profile`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
        
        toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated."
      });

      // Refresh profile data
      await fetchPatientProfile();
      setEditingProfile(false);
      setProfilePhoto(null);
      setProfilePhotoPreview('');
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast({
        title: "Update failed",
        description: err.response?.data?.message || "Could not update profile.",
        variant: "destructive"
      });
    } finally {
      setSavingProfile(false);
    }
  };
  
  const cancelProfileEditing = () => {
    setEditingProfile(false);
    setProfileFormData({});
    setProfilePhoto(null);
    setProfilePhotoPreview('');
  };

  // Utility functions
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const formatTime = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Filter appointments based on current filter
  const filteredAppointments = (Array.isArray(appointments) ? appointments : []).filter(appointment => {
    if (appointmentFilter === "all") return true;
    if (appointmentFilter === "upcoming") {
      return new Date(appointment.appointment_date) > new Date() && appointment.status !== 'cancelled';
    }
    if (appointmentFilter === "completed") {
      return appointment.status === 'completed';
    }
    return true;
  });

  // Filter doctors based on search term
  const filteredDoctors = (Array.isArray(doctors) ? doctors : []).filter(doctor =>
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add the utility function after other utility functions
  const canJoinConsultation = (appointmentDate: string): { canJoin: boolean; message: string } => {
    const now = new Date();
    const appointmentTime = new Date(appointmentDate);
    const fiveMinutesBefore = new Date(appointmentTime.getTime() - 5 * 60 * 1000);
    
    // If appointment is more than 5 minutes in the future
    if (now < fiveMinutesBefore) {
      const timeUntil = Math.ceil((fiveMinutesBefore.getTime() - now.getTime()) / (60 * 1000));
      return {
        canJoin: false,
        message: `Consultation will be available in ${timeUntil} minutes`
      };
    }
    
    // If appointment is in the past (more than 30 minutes after start time)
    const thirtyMinutesAfter = new Date(appointmentTime.getTime() + 30 * 60 * 1000);
    if (now > thirtyMinutesAfter) {
      return {
        canJoin: false,
        message: 'Consultation time has expired'
      };
    }
    
    return {
      canJoin: true,
      message: 'Join Consultation'
    };
  };

  // Handle payment history tab click
  const handlePaymentsClick = () => {
    setActiveTab("payments");
  };
  
  const formatCurrency = (amount: number, currency: string = '₹') => {
    return `${currency}${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue mx-auto" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="text-center flex-grow">
          <h1 className="text-3xl font-heading font-bold">Patient Dashboard</h1>
          {patientProfile && (
            <p className="text-gray-600 mt-1">Welcome back, {patientProfile.name}!</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2" 
            onClick={refreshDashboard}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          
          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                sessionStorage.setItem('from_patient_dashboard', 'true');
                navigate('/');
              }} className="flex items-center">
                <Home className="h-4 w-4 mr-2" />
                Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab("profile")} className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                Create Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="flex items-center text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-medical-blue/10 cursor-pointer hover:bg-medical-blue/20 transition-colors" onClick={handleUpcomingAppointmentsClick}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.upcomingAppointments}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-medical-teal/10 cursor-pointer hover:bg-medical-teal/20 transition-colors" onClick={handleCompletedSessionsClick}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Completed Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completedSessions}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-medical-accent/10 cursor-pointer hover:bg-medical-accent/20 transition-colors" onClick={handlePaymentsClick}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(paymentStats.totalSpent)}</div>
            {paymentStats.refundedAmount > 0 && (
              <div className="text-sm text-green-600 mt-1">
                {formatCurrency(paymentStats.refundedAmount)} refunded
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-purple-100 cursor-pointer hover:bg-purple-200 transition-colors" onClick={() => setActiveTab("profile")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Health Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.profileCompletion} className="h-2" />
            <p className="text-sm mt-2">{Math.round(stats.profileCompletion)}% Complete</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
          <TabsTrigger value="doctors">Find Doctors</TabsTrigger>
          <TabsTrigger value="appointments">My Appointments</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Edit className="h-5 w-5 mr-2 text-medical-blue" />
                    Edit Profile
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and profile picture
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {editingProfile ? (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={cancelProfileEditing}
                        disabled={savingProfile}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={saveProfileChanges}
                        disabled={savingProfile}
                        className="bg-medical-blue hover:bg-medical-blue/90"
                      >
                        {savingProfile ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={() => setEditingProfile(true)}
                      className="bg-medical-blue hover:bg-medical-blue/90"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                {/* Profile Picture Section */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-32 w-32 border-4 border-gray-200">
                      <AvatarImage 
                        src={profilePhotoPreview || patientProfile?.profile_picture || ""} 
                        alt={patientProfile?.name} 
                      />
                      <AvatarFallback className="text-2xl font-semibold bg-medical-blue text-white">
                        {patientProfile?.name ? patientProfile.name.split(' ').map(n => n[0]).join('') : "P"}
                      </AvatarFallback>
                    </Avatar>
                    
                    {editingProfile && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                        <Label htmlFor="profile-photo" className="cursor-pointer text-white hover:text-gray-200">
                          <Camera className="h-8 w-8" />
                          <Input
                            id="profile-photo"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoChange}
                            className="hidden"
                          />
                        </Label>
                      </div>
                    )}
                  </div>
                  
                  {editingProfile && (
                    <div className="text-center">
                      <Label htmlFor="profile-photo" className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <Upload className="h-4 w-4 mr-2" />
                        {profilePhoto ? 'Change Photo' : 'Upload Photo'}
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                    </div>
                  )}
                </div>
                
                {/* Profile Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileFormData.name || patientProfile?.name || ''}
                      onChange={(e) => handleProfileFormChange('name', e.target.value)}
                      disabled={!editingProfile}
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileFormData.email || patientProfile?.email || ''}
                      onChange={(e) => handleProfileFormChange('email', e.target.value)}
                      disabled={!editingProfile}
                      placeholder="Enter your email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileFormData.phone || patientProfile?.phone || ''}
                      onChange={(e) => handleProfileFormChange('phone', e.target.value)}
                      disabled={!editingProfile}
                      placeholder="Enter your phone number"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Input
                      id="gender"
                      value={profileFormData.gender || patientProfile?.gender || ''}
                      onChange={(e) => handleProfileFormChange('gender', e.target.value)}
                      disabled={!editingProfile}
                      placeholder="Enter your gender"
                    />
                </div>
                
                <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                      id="dateOfBirth"
                      type="date"
                      value={profileFormData.dateOfBirth || patientProfile?.dateOfBirth || ''}
                      onChange={(e) => handleProfileFormChange('dateOfBirth', e.target.value)}
                      disabled={!editingProfile}
                    />
                </div>
                  </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Find Doctors</CardTitle>
              <CardDescription>Browse available doctors and book consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <Input
              placeholder="Search doctors by name or specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
            />
          </div>

          {doctorsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-medical-blue" />
            </div>
              ) : filteredDoctors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map((doctor) => (
                    <Card key={doctor.id} className={`transition-all ${doctor.isAvailable ? 'hover:shadow-lg' : 'opacity-60'}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={doctor.profile_picture} alt={doctor.name} />
                            <AvatarFallback>
                        {doctor.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{doctor.name}</h3>
                            <p className="text-gray-600">{doctor.specialty}</p>
                            {doctor.experience_years && (
                              <p className="text-sm text-gray-500">{doctor.experience_years} years experience</p>
                            )}
                      </div>
                        </div>
                        
                        {doctor.bio && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-3">{doctor.bio}</p>
                    )}
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 ml-1">4.8 (120)</span>
                  </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Consultation Fee</div>
                            <div className="font-bold">₹{doctor.consultationFee}</div>
                    </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4">
                    <Link to={`/book/${doctor.id}`} className="w-full">
                      <Button className="w-full" disabled={!doctor.isAvailable}>
                        {doctor.isAvailable ? 'Book Consultation' : 'Not Available'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No doctors found matching your search.</p>
                </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>My Appointments</CardTitle>
              <CardDescription>Manage your scheduled consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Button 
                  variant={appointmentFilter === "all" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setAppointmentFilter("all")}
                >
                  All
                </Button>
                <Button 
                  variant={appointmentFilter === "upcoming" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setAppointmentFilter("upcoming")}
                >
                  Upcoming
                </Button>
                <Button 
                  variant={appointmentFilter === "completed" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setAppointmentFilter("completed")}
                >
                  Completed
                </Button>
              </div>
              
              {appointmentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-medical-blue" />
                </div>
              ) : filteredAppointments.length > 0 ? (
                <div className="space-y-4">
                  {filteredAppointments.map((appointment) => (
                    <Card key={appointment.id} className={`${['pending', 'confirmed'].includes(appointment.status) ? "border-medical-blue" : "border-gray-200"}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-lg">Dr. {appointment.doctor_name}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(appointment.appointment_date)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(appointment.appointment_date)}
                            </div>
                            {appointment.reason && (
                              <p className="text-sm text-gray-600 mt-2">{appointment.reason}</p>
                            )}
                            {appointment.consultation_type && (
                              <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
                                {appointment.consultation_type === 'video' && <Video className="h-4 w-4" />}
                                {appointment.consultation_type === 'chat' && <MessageCircle className="h-4 w-4" />}
                                {appointment.consultation_type === 'phone' && <Phone className="h-4 w-4" />}
                                {appointment.consultation_type === 'video' ? 'Video Call' : 
                                 appointment.consultation_type === 'chat' ? 'Chat' : 'Phone Call'}
                              </div>
                            )}
                          </div>
                          <div>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                              appointment.status === 'pending' 
                                ? "bg-yellow-100 text-yellow-600" 
                                : appointment.status === 'confirmed'
                                  ? "bg-medical-blue/20 text-medical-blue"
                                  : appointment.status === 'completed'
                                    ? "bg-green-100 text-green-600"
                                    : "bg-gray-100 text-gray-600"
                            }`}>
                              {appointment.status === 'pending' ? 'Pending Approval' :
                               appointment.status === 'confirmed' ? 'Payment Confirmed' :
                               appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Action buttons based on appointment status */}
                        <div className="flex gap-2 mt-4">
                          {appointment.status === 'pending' && (
                            <div className="w-full bg-yellow-50 p-3 rounded-md">
                              <p className="text-sm text-yellow-700">
                                ⏳ Waiting for doctor approval. You'll be notified once approved.
                              </p>
                            </div>
                          )}
                          
                          {appointment.status === 'confirmed' && (
                            <>
                              {(() => {
                                const { canJoin, message } = canJoinConsultation(appointment.appointment_date);
                                return (
                            <>
                              <Button 
                                      className={`flex-1 ${canJoin 
                                        ? 'bg-medical-blue hover:bg-medical-blue/90' 
                                        : 'bg-gray-200 hover:bg-gray-200 cursor-not-allowed'}`}
                                      onClick={() => canJoin && handleJoinConsultation(appointment)}
                                      disabled={!canJoin}
                              >
                                {appointment.consultation_type === 'voice' || appointment.consultation_type === 'phone' ? (
                                  <>
                                    <Phone className="h-4 w-4 mr-2" />
                                          {message}
                                  </>
                                ) : (
                                  <>
                                <Video className="h-4 w-4 mr-2" />
                                          {message}
                                  </>
                                )}
                              </Button>
                                    {!canJoin && (
                                      <div className="w-full mt-2">
                                        <p className="text-sm text-gray-600 text-center">{message}</p>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              <Button variant="outline" className="flex-1">
                                Reschedule
                              </Button>
                            </>
                          )}
                          
                          {appointment.status === 'completed' && (
                            <div className="w-full space-y-2">
                              <div className="bg-green-50 p-3 rounded-md">
                                <p className="text-sm text-green-700">
                                  ✅ Consultation completed successfully
                                </p>
                              </div>
                              <Button variant="outline" className="w-full">
                                Leave Feedback
                              </Button>
                            </div>
                          )}
                          
                          {appointment.status === 'cancelled' && (
                            <div className="w-full bg-red-50 p-3 rounded-md">
                              <p className="text-sm text-red-700 font-medium">
                                ❌ Appointment was cancelled
                              </p>
                              {appointment.rejection_reason && (
                                <p className="text-sm text-red-600 mt-2">
                                  <span className="font-medium">Reason: </span>
                                  {appointment.rejection_reason}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">
                    {appointmentFilter === "all" 
                      ? "You don't have any appointments yet" 
                      : `You don't have any ${appointmentFilter} appointments`
                    }
                  </p>
                  <Button onClick={() => setActiveTab("doctors")}>
                    Find a Doctor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your payment history and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-medical-blue" />
                </div>
              ) : payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-4 text-left">Date</th>
                        <th className="py-2 px-4 text-left">Doctor</th>
                        <th className="py-2 px-4 text-left">Amount</th>
                        <th className="py-2 px-4 text-left">Status</th>
                        <th className="py-2 px-4 text-left">Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {payment.created_at ? formatDate(payment.created_at) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            {payment.doctor_name ? `Dr. ${payment.doctor_name}` : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {payment.amount ? formatCurrency(payment.amount) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                              payment.status === 'completed' 
                                ? "bg-green-100 text-green-700" 
                                : payment.status === 'refunded'
                                  ? "bg-blue-100 text-blue-700"
                                  : payment.status === 'failed'
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {payment.status ? payment.status.charAt(0).toUpperCase() + payment.status.slice(1) : 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4 capitalize">
                            {payment.payment_method || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">You don't have any payment history yet</p>
                  <Button onClick={() => setActiveTab("doctors")}>
                    Book Your First Consultation
                  </Button>
                </div>
              )}
              
              {payments && payments.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Spent:</span>
                    <span className="font-bold">{formatCurrency(paymentStats.totalSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Refunded Amount:</span>
                    <span className="font-bold">{formatCurrency(paymentStats.refundedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Payment:</span>
                    <span className="font-bold">{formatCurrency(paymentStats.totalSpent - paymentStats.refundedAmount)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Appointment Notifications */}
      {showNotifications && (
        <AppointmentNotification 
          userRole="patient" 
          onClose={() => setShowNotifications(false)} 
        />
      )}
    </div>
  );
};

export default PatientDashboard; 