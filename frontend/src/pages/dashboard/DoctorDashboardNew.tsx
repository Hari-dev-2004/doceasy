import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, User, UserCheck, Video, ClipboardList, AlertCircle, Loader2, Calendar as CalendarIcon, CheckCircle, XCircle, LogOut, RefreshCw, Plus, Trash2, Save, Camera, Upload, Edit, CreditCard, DollarSign, Phone, Home, MoreVertical, MessageCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from 'axios';
import Footer from '@/components/layout/Footer';
import AppointmentNotification from '@/components/AppointmentNotification';
import DoctorNavbar from '@/components/layout/DoctorNavbar';
import { API_URL } from "@/config";

// Using relative API paths with Vite proxy
// const API_URL = '';

// Interfaces for availability management
interface TimeSlot {
  start_time: string;
  end_time: string;
  id?: string;
  is_recurring: boolean;
}

interface DayAvailability {
  is_available: boolean;
  is_recurring: boolean;
  time_slots: TimeSlot[];
}

interface WeeklyAvailability {
  sunday: DayAvailability;
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
}

interface AvailabilityData {
  id?: string;
  doctor_id: string;
  weekly_availability: WeeklyAvailability;
  created_at?: string;
  updated_at?: string;
}

const DoctorDashboardNew = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [loadingTotalPatients, setLoadingTotalPatients] = useState(false);
  
  // Tab-specific data
  const [pendingAppointments, setPendingAppointments] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientDetailLoading, setPatientDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Availability management state
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState<any>({});
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Payment history state
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(true);
  
  // Rejection dialog state
  const [rejectionDialog, setRejectionDialog] = useState<{ isOpen: boolean; appointmentId: number | null; reason: string }>({
    isOpen: false,
    appointmentId: null,
    reason: ''
  });
  
  // Add WebSocket state
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // Add polling interval state
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('user_role');
    
    if (!token || userRole !== 'doctor') {
      navigate('/login/doctor');
      return;
    }
    
    // Load all data when component mounts
    fetchDoctorProfile();
    fetchPendingAppointments();
    fetchTodayAppointments();
    fetchPatients();
    fetchTotalPatients();
    fetchAvailability();
    fetchPaymentHistory();
    fetchPaymentStats();
  }, [navigate]);
  
  // Fetch total number of patients
  const fetchTotalPatients = async () => {
    const token = localStorage.getItem('token');
    setLoadingTotalPatients(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/stats/total-patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTotalPatients(response.data.totalPatients || 0);
      toast({
        title: "Statistics Updated",
        description: "Total patients count has been refreshed.",
        duration: 3000
      });
    } catch (err) {
      console.error('Error fetching total patients:', err);
      toast({
        variant: "destructive",
        title: "Failed to fetch statistics",
        description: "Could not retrieve the total patients count.",
        duration: 3000
      });
    } finally {
      setLoadingTotalPatients(false);
    }
  };
  
  // Fetch doctor profile
  const fetchDoctorProfile = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfileData(response.data);
      
      // If doctor doesn't have a profile yet, redirect to profile creation
      if (!response.data.first_name || !response.data.specialty) {
        navigate('/doctor-profile-creation');
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      
      if (err.response && err.response.status === 404) {
        // If no profile found, redirect to profile creation
        navigate('/doctor-profile-creation');
      } else {
        setError('Could not load profile data');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Manual refresh profile data
  const refreshProfile = async () => {
    setIsRefreshingProfile(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfileData(response.data);
      
      toast({
        title: "Profile Updated",
        description: "Your profile information has been refreshed.",
        duration: 3000
      });
    } catch (err) {
      console.error('Error refreshing profile:', err);
      toast({
        variant: "destructive",
        title: "Failed to refresh profile",
        description: "Could not update profile information.",
        duration: 3000
      });
    } finally {
      setIsRefreshingProfile(false);
    }
  };
  
  // Fetch pending appointment requests
  const fetchPendingAppointments = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/appointments/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPendingAppointments(response.data.appointments || []);
    } catch (err) {
      console.error('Error fetching pending appointments:', err);
      setPendingAppointments([]); // Ensure array is set on error
    }
  };
  
  // Fetch today's appointments with date filtering
  const fetchTodayAppointments = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/appointments/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The backend already filters for today's appointments, just sort them by time
      const todayAppts = (response.data.appointments || []).sort((a: any, b: any) => 
        new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
      );
      
      console.log('Today\'s appointments:', todayAppts);
      setTodayAppointments(todayAppts);
    } catch (err) {
      console.error('Error fetching today appointments:', err);
      setTodayAppointments([]); // Ensure array is set on error
    }
  };
  
  // Fetch patients history
  const fetchPatients = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPatients(response.data.patients || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setPatients([]); // Ensure array is set on error
    }
  };
  
  // Fetch patient details
  const fetchPatientDetails = async (patientId: number) => {
    const token = localStorage.getItem('token');
    setPatientDetailLoading(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/patients/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedPatient(response.data);
    } catch (err) {
      console.error('Error fetching patient details:', err);
      toast({
        title: "Failed to load patient details",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setPatientDetailLoading(false);
    }
  };
  
  // Fetch doctor availability
  const fetchAvailability = async () => {
    const token = localStorage.getItem('token');
    setLoadingAvailability(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAvailability(response.data.availability);
    } catch (err) {
      console.error('Error fetching availability:', err);
      // Initialize with default availability structure
      const defaultAvailability = createDefaultAvailability();
      setAvailability(defaultAvailability);
    } finally {
      setLoadingAvailability(false);
    }
  };
  
  // Create default availability structure
  const createDefaultAvailability = (): AvailabilityData => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const weeklyAvailability = {} as WeeklyAvailability;
    
    days.forEach(day => {
      weeklyAvailability[day as keyof WeeklyAvailability] = {
        is_available: false,
        is_recurring: true, // Default to recurring
        time_slots: []
      };
    });
    
    return {
      doctor_id: profileData?.id || '',
      weekly_availability: weeklyAvailability
    };
  };
  
  // Save availability
  const saveAvailability = async () => {
    if (!availability) return;
    
    const token = localStorage.getItem('token');
    setSavingAvailability(true);
    
    try {
      // Transform the availability data to include recurring information
      const availabilityData = {
        weekly_availability: Object.entries(availability.weekly_availability).reduce((acc, [day, dayData]) => {
          return {
            ...acc,
            [day]: {
              ...dayData,
              time_slots: dayData.time_slots.map(slot => ({
                ...slot,
                is_recurring: true // Make all slots recurring by default
              }))
            }
          };
        }, {})
      };

      const response = await axios.put(`${API_URL}/api/doctor/availability`, availabilityData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAvailability(response.data.availability);
      
      toast({
        title: "Availability Updated",
        description: "Your weekly availability has been saved and will recur every week.",
      });
    } catch (err) {
      console.error('Error saving availability:', err);
      toast({
        title: "Failed to save availability",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSavingAvailability(false);
    }
  };
  
  // Toggle day availability
  const toggleDayAvailability = (day: keyof WeeklyAvailability, isAvailable: boolean) => {
    if (!availability) return;
    
    setAvailability({
      ...availability,
      weekly_availability: {
        ...availability.weekly_availability,
        [day]: {
          ...availability.weekly_availability[day],
          is_available: isAvailable,
          time_slots: isAvailable ? availability.weekly_availability[day].time_slots : []
        }
      }
    });
  };
  
  // Add time slot to a day
  const addTimeSlot = (day: keyof WeeklyAvailability) => {
    if (!availability) return;
    
    const newSlot: TimeSlot = {
      start_time: '09:00',
      end_time: '10:00',
      id: Date.now().toString(),
      is_recurring: true // Default to recurring
    };
    
    setAvailability({
      ...availability,
      weekly_availability: {
        ...availability.weekly_availability,
        [day]: {
          ...availability.weekly_availability[day],
          time_slots: [...availability.weekly_availability[day].time_slots, newSlot]
        }
      }
    });
  };
  
  // Remove time slot from a day
  const removeTimeSlot = (day: keyof WeeklyAvailability, index: number) => {
    if (!availability) return;
    
    const updatedSlots = [...availability.weekly_availability[day].time_slots];
    updatedSlots.splice(index, 1);
    
    setAvailability({
      ...availability,
      weekly_availability: {
        ...availability.weekly_availability,
        [day]: {
          ...availability.weekly_availability[day],
          time_slots: updatedSlots
        }
      }
    });
  };
  
  // Update time slot
  const updateTimeSlot = (day: keyof WeeklyAvailability, index: number, field: 'start_time' | 'end_time', value: string) => {
    if (!availability) return;
    
    const updatedSlots = [...availability.weekly_availability[day].time_slots];
    updatedSlots[index] = {
      ...updatedSlots[index],
      [field]: value
    };
    
    setAvailability({
      ...availability,
      weekly_availability: {
        ...availability.weekly_availability,
        [day]: {
          ...availability.weekly_availability[day],
          time_slots: updatedSlots
        }
      }
    });
  };
  
  // Handle appointment acceptance
  const handleAcceptAppointment = async (appointmentId: number) => {
    const token = localStorage.getItem('token');
    
    try {
      await axios.post(`${API_URL}/api/appointments/${appointmentId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the lists
      fetchPendingAppointments();
      fetchTodayAppointments();
      
      toast({
        title: "Appointment accepted",
        description: "The appointment has been confirmed.",
      });
    } catch (err) {
      console.error('Error accepting appointment:', err);
      toast({
        title: "Failed to accept appointment",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };
  
  // Handle opening rejection dialog
  const openRejectionDialog = (appointmentId: number) => {
    setRejectionDialog({
      isOpen: true,
      appointmentId,
      reason: ''
    });
  };

  // Handle closing rejection dialog
  const closeRejectionDialog = () => {
    setRejectionDialog({
      isOpen: false,
      appointmentId: null,
      reason: ''
    });
  };

  // Handle appointment decline
  const handleDeclineAppointment = async () => {
    if (!rejectionDialog.appointmentId || !rejectionDialog.reason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for declining the appointment.",
        variant: "destructive",
      });
      return;
    }

    const token = localStorage.getItem('token');
    
    try {
      await axios.post(`${API_URL}/api/appointments/${rejectionDialog.appointmentId}/decline`, {
        rejection_reason: rejectionDialog.reason.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the lists
      fetchPendingAppointments();
      
      toast({
        title: "Appointment declined",
        description: "The appointment has been declined with the provided reason.",
      });

      // Close the dialog
      closeRejectionDialog();
    } catch (err) {
      console.error('Error declining appointment:', err);
      toast({
        title: "Failed to decline appointment",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };
  
  // Start video call or voice call based on consultation type
  const startConsultation = (appointment: any) => {
    // Navigate directly to VideoCall page with the appointment ID
    // This will ensure patient and doctor join the same meeting room
    navigate(`/video-call/${appointment.id}`);
  };
  
  // Format date
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Format time
  const formatTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };
  
  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string) => {
    const dob = new Date(dateOfBirth);
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };
  
  // Format payment status for display
  const formatPaymentStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Payment Successful';
      case 'hold':
        return 'Payment On Hold';
      case 'pending':
        return 'Payment Pending';
      case 'failed':
        return 'Payment Failed';
      case 'refunded':
        return 'Payment Refunded';
      default:
        return 'Unknown Status';
    }
  };
  
  // Get payment status badge variant
  const getPaymentStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'; // Green
      case 'hold':
        return 'secondary'; // Blue
      case 'pending':
        return 'outline'; // Yellow/Orange
      case 'failed':
        return 'destructive'; // Red
      case 'refunded':
        return 'secondary'; // Blue
      default:
        return 'outline';
    }
  };
  
  // Format currency amount
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Handle logout
  const handleLogout = () => {
    setIsLoggingOut(true);
    
    try {
      // Clear all authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      
      // Show success message
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Redirect to home page
      navigate('/');
    } catch (err) {
      console.error('Error during logout:', err);
      toast({
        title: "Logout failed",
        description: "There was an issue logging you out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  // Handle profile photo selection
  const handleProfilePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setProfilePhoto(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Initialize profile form data when profileData changes
  useEffect(() => {
    if (profileData && !editingProfile) {
      setProfileFormData({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        phone: profileData.phone || '',
        specialty: profileData.specialty || '',
        experience_years: profileData.experience_years || '',
        consultationFee: profileData.consultationFee || '',
        bio: profileData.bio || '',
      });
      setProfilePhotoPreview(profileData.profile_picture || '');
    }
  }, [profileData, editingProfile]);
  
  // Handle profile form input changes
  const handleProfileFormChange = (field: string, value: string) => {
    setProfileFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Save profile changes
  const saveProfileChanges = async () => {
    const token = localStorage.getItem('token');
    setSavingProfile(true);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add profile data
      Object.keys(profileFormData).forEach(key => {
        if (profileFormData[key]) {
          formData.append(key, profileFormData[key]);
        }
      });
      
      // Add profile photo if selected
      if (profilePhoto) {
        formData.append('profile_picture', profilePhoto);
      }
      
      const response = await axios.put(`${API_URL}/api/doctor/profile`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data) {
        setProfileData(response.data);
        setEditingProfile(false);
        setProfilePhoto(null);
        
        toast({
          title: "Profile Updated",
          description: "Your profile has been updated successfully.",
        });
      }
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast({
        title: "Failed to update profile",
        description: err.response?.data?.error || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };
  
  // Cancel profile editing
  const cancelProfileEditing = () => {
    setEditingProfile(false);
    setProfilePhoto(null);
    setProfilePhotoPreview(profileData?.profile_picture || '');
    // Reset form data to original values
    setProfileFormData({
      first_name: profileData?.first_name || '',
      last_name: profileData?.last_name || '',
      phone: profileData?.phone || '',
      specialty: profileData?.specialty || '',
      experience_years: profileData?.experience_years || '',
      consultationFee: profileData?.consultationFee || '',
      bio: profileData?.bio || '',
    });
  };
  
  // Fetch payment history
  const fetchPaymentHistory = async () => {
    const token = localStorage.getItem('token');
    setLoadingPayments(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/payments/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPaymentHistory(response.data.payments || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      toast({
        title: "Failed to load payment history",
        description: "Could not retrieve payment information",
        variant: "destructive",
      });
    } finally {
      setLoadingPayments(false);
    }
  };
  
  // Fetch payment statistics
  const fetchPaymentStats = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/payments/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPaymentStats(response.data.stats || {});
    } catch (err) {
      console.error('Error fetching payment stats:', err);
    }
  };
  
  // Fetch payment details for specific appointment
  const fetchPaymentDetails = async (appointmentId: string) => {
    const token = localStorage.getItem('token');
    setPaymentDetailLoading(true);
    
    try {
      const response = await axios.get(`${API_URL}/api/doctor/payments/appointment/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedPayment(response.data.payment);
    } catch (err) {
      console.error('Error fetching payment details:', err);
      toast({
        title: "Failed to load payment details",
        description: "Could not retrieve payment information",
        variant: "destructive",
      });
    } finally {
      setPaymentDetailLoading(false);
    }
  };
  
  // Handle navigation to home
  const handleHomeNavigation = () => {
    sessionStorage.setItem('from_doctor_dashboard', 'true');
    navigate('/');
  };
  
  // Add these utility functions after the existing utility functions
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
  
  // Initialize WebSocket connection
  const initializeWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/ws/doctor/appointments`);
    
    ws.onopen = () => {
      // Send authentication
      ws.send(JSON.stringify({ token }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'appointment_update') {
        // Refresh appointments when we receive an update
        fetchTodayAppointments();
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Fall back to polling on WebSocket error
      startPolling();
    };
    
    ws.onclose = () => {
      // Fall back to polling when WebSocket closes
      startPolling();
    };
    
    setSocket(ws);
  };
  
  // Start polling for updates
  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    
    const interval = setInterval(() => {
      fetchTodayAppointments();
    }, 30000); // Poll every 30 seconds
    
    setPollingInterval(interval);
  };
  
  // Clean up function
  const cleanup = () => {
    if (socket) {
      socket.close();
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
  };
  
  // Add useEffect for WebSocket and polling
  useEffect(() => {
    // Try WebSocket first
    initializeWebSocket();
    
    // Clean up on unmount
    return () => cleanup();
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <DoctorNavbar 
          onHomeClick={handleHomeNavigation}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
        <div className="flex-grow flex flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 text-medical-teal animate-spin mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <DoctorNavbar 
          onHomeClick={handleHomeNavigation}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="text-center mb-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Unable to Load Dashboard</h1>
            <p className="text-gray-600 mt-2">{error}</p>
          </div>
          <Button onClick={() => navigate('/login/doctor')}>Return to Login</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DoctorNavbar 
        onHomeClick={handleHomeNavigation}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />
      
      <div className="flex-grow container mx-auto py-8 px-4 md:px-6">
        {/* Doctor Profile Header */}
        {profileData && (
          <div className="mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-gray-200">
                <AvatarImage src={profileData.profile_picture || ""} alt={profileData.full_name} />
                <AvatarFallback className="text-xl font-semibold bg-medical-teal text-white">
                  {profileData.first_name ? profileData.first_name[0] + (profileData.last_name ? profileData.last_name[0] : "") : "Dr"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-grow">
                <h1 className="text-2xl font-bold text-gray-900">
                  Dr. {profileData.first_name} {profileData.last_name}
                </h1>
                <p className="text-gray-600">{profileData.specialty}</p>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                    {profileData.experience_years ? `${profileData.experience_years}+ Years Experience` : "Medical Doctor"}
                  </Badge>
                  
                  <Badge variant="outline" className={
                    profileData.verificationStatus === "approved" 
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : profileData.verificationStatus === "admin_pending" || profileData.verificationStatus === "pending"
                        ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                  }>
                    {profileData.verificationStatus === "approved" 
                      ? "Verified Doctor" 
                      : profileData.verificationStatus === "admin_pending" || profileData.verificationStatus === "pending"
                        ? "Verification Pending"
                        : "Verification Required"}
                  </Badge>
                </div>
              </div>
              
              {profileData.verificationStatus === "approved" ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="text-gray-600" onClick={() => setActiveTab('pending')}>
                    <ClipboardList className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Appointments</span>
                  </Button>
                  
                  <Button variant="outline" className="text-gray-600" onClick={() => setActiveTab('patients')}>
                    <UserCheck className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Patients</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="text-gray-600 hover:bg-gray-50" 
                    onClick={refreshProfile}
                    disabled={isRefreshingProfile}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshingProfile ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-md max-w-xs">
                    <h4 className="font-semibold flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Profile Verification Pending
                    </h4>
                    <p className="text-sm mt-1">
                      Your profile is being reviewed. You'll have full access once verified.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 max-w-xs">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-gray-600 hover:bg-gray-50" 
                      onClick={refreshProfile}
                      disabled={isRefreshingProfile}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshingProfile ? 'animate-spin' : ''}`} />
                      Check Status
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="bg-medical-blue/10 cursor-pointer transition-all hover:shadow-md" 
            onClick={fetchTotalPatients}
          >
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Patients</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {loadingTotalPatients ? (
                      <Loader2 className="h-6 w-6 animate-spin text-medical-blue" />
                    ) : (
                      totalPatients
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Click to refresh</p>
                </div>
                <div className="bg-medical-blue/20 p-3 rounded-full">
                  <User className="h-6 w-6 text-medical-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Additional stat cards can be added here */}
        </div>
        
        {/* Main Content */}
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="profile" className="relative">
              <Edit className="h-4 w-4 mr-1" />
              Edit Profile
            </TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending Requests
              {pendingAppointments.length > 0 && (
                <span className="absolute top-0 right-1 transform -translate-y-1/2 translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-medical-teal text-xs font-medium text-white">
                  {pendingAppointments.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="today">Today's Appointments</TabsTrigger>
            <TabsTrigger value="availability">Weekly Availability</TabsTrigger>
            <TabsTrigger value="patients">Patient History</TabsTrigger>
          </TabsList>
          
          {/* Edit Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Edit className="h-5 w-5 mr-2 text-medical-teal" />
                      Edit Profile
                    </CardTitle>
                    <CardDescription>
                      Update your professional information and profile picture
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
                          className="bg-medical-teal hover:bg-medical-teal/90"
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
                        className="bg-medical-teal hover:bg-medical-teal/90"
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
                          src={profilePhotoPreview || profileData?.profile_picture || ""} 
                          alt={profileData?.full_name} 
                        />
                        <AvatarFallback className="text-2xl font-semibold bg-medical-teal text-white">
                          {profileData?.first_name ? profileData.first_name[0] + (profileData.last_name ? profileData.last_name[0] : "") : "Dr"}
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
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={profileFormData.first_name || ''}
                        onChange={(e) => handleProfileFormChange('first_name', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={profileFormData.last_name || ''}
                        onChange={(e) => handleProfileFormChange('last_name', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profileFormData.phone || ''}
                        onChange={(e) => handleProfileFormChange('phone', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        value={profileFormData.specialty || ''}
                        onChange={(e) => handleProfileFormChange('specialty', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="experience_years">Years of Experience</Label>
                      <Input
                        id="experience_years"
                        type="number"
                        value={profileFormData.experience_years || ''}
                        onChange={(e) => handleProfileFormChange('experience_years', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="consultationFee">Consultation Fee (₹)</Label>
                      <Input
                        id="consultationFee"
                        type="number"
                        placeholder="1500"
                        value={profileFormData.consultationFee || ''}
                        onChange={(e) => handleProfileFormChange('consultationFee', e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? 'bg-gray-50' : ''}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileFormData.bio || ''}
                      onChange={(e) => handleProfileFormChange('bio', e.target.value)}
                      disabled={!editingProfile}
                      className={!editingProfile ? 'bg-gray-50' : ''}
                      rows={4}
                      placeholder="Tell patients about yourself, your experience, and specializations..."
                    />
                  </div>
                  
                  {/* Email (Read-only) */}
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={profileData?.email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  
                  {/* Verification Status */}
                  <div>
                    <Label>Verification Status</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={
                        profileData?.verificationStatus === "approved" 
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : profileData?.verificationStatus === "admin_pending" || profileData?.verificationStatus === "pending"
                            ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                            : "bg-red-50 text-red-700 hover:bg-red-100"
                      }>
                        {profileData?.verificationStatus === "approved" 
                          ? "Verified Doctor" 
                          : profileData?.verificationStatus === "admin_pending" || profileData?.verificationStatus === "pending"
                            ? "Verification Pending"
                            : "Verification Required"}
                      </Badge>
                    </div>
                  </div>
                  
                  {editingProfile && (
                    <div className="bg-blue-50 p-4 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Profile Update Tips:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Make sure all information is accurate and up to date</li>
                            <li>Your profile photo should be professional and clear</li>
                            <li>A detailed bio helps patients understand your expertise</li>
                            <li>Changes may require admin review for verification status</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Pending Appointments Tab */}
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-medical-teal" />
                  Pending Appointment Requests
                </CardTitle>
                <CardDescription>
                  Review and respond to appointment requests from patients
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {pendingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No pending requests</h3>
                    <p className="text-gray-500 mt-1">You have no pending appointment requests at this time</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAppointments.map((appointment) => (
                      <Card key={appointment.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={appointment.patient_photo} />
                                  <AvatarFallback>{appointment.patient_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-medium">{appointment.patient_name}</h4>
                                  <p className="text-sm text-gray-500">{appointment.patient_phone || 'No phone provided'}</p>
                                </div>
                              </div>
                              
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(appointment.appointment_date)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Clock className="h-4 w-4" />
                                  {formatTime(appointment.appointment_date)}
                                </div>
                                {appointment.consultation_type && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    {appointment.consultation_type === 'video' && <Video className="h-4 w-4" />}
                                    {appointment.consultation_type === 'chat' && <MessageCircle className="h-4 w-4" />}
                                    {appointment.consultation_type === 'phone' && <Phone className="h-4 w-4" />}
                                    {appointment.consultation_type.charAt(0).toUpperCase() + appointment.consultation_type.slice(1)} Consultation
                                  </div>
                                )}
                                {appointment.urgent && (
                                  <Badge variant="destructive" className="mt-2">
                                    Urgent
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="mt-4">
                                <h5 className="text-sm font-medium mb-1">Reason for Visit</h5>
                                <p className="text-sm text-gray-600">{appointment.reason}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                                onClick={() => openRejectionDialog(appointment.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                                onClick={() => handleAcceptAppointment(appointment.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Today's Appointments Tab */}
          <TabsContent value="today" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-medical-teal" />
                  Today's Appointments
                </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                  Scheduled consultations for today
                      {socket?.readyState === WebSocket.OPEN ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Live Updates
                        </Badge>
                      ) : pollingInterval ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Auto Refresh
                        </Badge>
                      ) : null}
                </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchTodayAppointments}
                    className="text-medical-teal border-medical-teal hover:bg-medical-teal/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No appointments today</h3>
                    <p className="text-gray-500 mt-1">You have no scheduled appointments for today</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todayAppointments.map((appointment) => (
                      <Card key={appointment.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-grow">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-medical-teal/20 text-medical-teal">
                                    {appointment.patient_name.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div>
                                  <h4 className="font-medium text-gray-900">{appointment.patient_name}</h4>
                                  
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                                      {formatTime(appointment.appointment_date)}
                                    </div>
                                    
                                    <Badge variant={
                                      appointment.status === 'confirmed' ? 'secondary' :
                                      appointment.status === 'completed' ? 'outline' : 'default'
                                    }>
                                      {appointment.status === 'confirmed' ? 'Confirmed' :
                                       appointment.status === 'completed' ? 'Completed' : appointment.status}
                                    </Badge>
                                  </div>
                                  
                                  {appointment.notes && (
                                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                      {appointment.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center ml-auto">
                              {appointment.status === 'confirmed' && (
                                <>
                                  {(() => {
                                    const { canJoin, message } = canJoinConsultation(appointment.appointment_date);
                                    return (
                              <Button 
                                variant="outline"
                                        className={`${canJoin 
                                          ? 'bg-medical-teal/10 text-medical-teal hover:bg-medical-teal/20' 
                                          : 'bg-gray-100 text-gray-500'} border-medical-teal/30`}
                                        onClick={() => canJoin && startConsultation(appointment)}
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
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Weekly Availability Tab */}
          <TabsContent value="availability" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-medical-teal" />
                      Weekly Availability
                    </CardTitle>
                    <CardDescription>
                      Manage your available time slots for each day of the week
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={saveAvailability}
                    disabled={savingAvailability || !availability}
                    className="bg-medical-teal hover:bg-medical-teal/90"
                  >
                    {savingAvailability ? (
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
                </div>
              </CardHeader>
              
              <CardContent>
                {loadingAvailability ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-medical-teal" />
                  </div>
                ) : availability ? (
                  <div className="space-y-6">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                      <Card key={day} className="border border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                            <h3 className="text-lg font-medium capitalize">{day}</h3>
                              <p className="text-sm text-gray-500">Repeats weekly</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`${day}-available`} className="text-sm">
                                Available
                              </Label>
                              <Switch
                                id={`${day}-available`}
                                checked={availability.weekly_availability[day as keyof WeeklyAvailability].is_available}
                                onCheckedChange={(checked) => toggleDayAvailability(day as keyof WeeklyAvailability, checked)}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        
                        {availability.weekly_availability[day as keyof WeeklyAvailability].is_available && (
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-700">Time Slots</h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimeSlot(day as keyof WeeklyAvailability)}
                                  className="text-medical-teal border-medical-teal hover:bg-medical-teal/10"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Slot
                                </Button>
                              </div>
                              
                              {availability.weekly_availability[day as keyof WeeklyAvailability].time_slots.length === 0 ? (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                  No time slots configured for this day
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {availability.weekly_availability[day as keyof WeeklyAvailability].time_slots.map((slot, index) => (
                                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                                      <div className="flex items-center gap-2 flex-grow">
                                        <Label className="text-sm text-gray-600 w-12">From:</Label>
                                        <Input
                                          type="time"
                                          value={slot.start_time}
                                          onChange={(e) => updateTimeSlot(day as keyof WeeklyAvailability, index, 'start_time', e.target.value)}
                                          className="w-32"
                                        />
                                        <Label className="text-sm text-gray-600 w-8">To:</Label>
                                        <Input
                                          type="time"
                                          value={slot.end_time}
                                          onChange={(e) => updateTimeSlot(day as keyof WeeklyAvailability, index, 'end_time', e.target.value)}
                                          className="w-32"
                                        />
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeTimeSlot(day as keyof WeeklyAvailability, index)}
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                    
                    <div className="bg-blue-50 p-4 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Availability Tips:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Enable availability for days you want to accept appointments</li>
                            <li>Add multiple time slots for different sessions (e.g., morning and evening)</li>
                            <li>Ensure time slots don't overlap</li>
                            <li>Save your changes to update patient booking options</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No availability data</h3>
                    <p className="text-gray-500 mt-1">Unable to load your availability schedule</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Patients History Tab */}
          <TabsContent value="patients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-medical-teal" />
                  Patient History
                </CardTitle>
                <CardDescription>
                  View records of previously consulted patients
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {patients.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No patient records</h3>
                    <p className="text-gray-500 mt-1">You have not consulted any patients yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {patients.map((patient) => (
                      <Dialog key={patient.id}>
                        <DialogTrigger asChild>
                          <Card className="bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fetchPatientDetails(patient.id)}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-medical-teal/20 text-medical-teal">
                                    {patient.name.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div>
                                  <h4 className="font-medium text-gray-900">{patient.name}</h4>
                                  <div className="flex items-center text-sm text-gray-500 mt-1">
                                    <span className="mr-2">{patient.gender}</span>
                                    <span>{calculateAge(patient.date_of_birth)} yrs</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </DialogTrigger>
                        
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Patient Details</DialogTitle>
                            <DialogDescription>
                              Medical history and consultation records
                            </DialogDescription>
                          </DialogHeader>
                          
                          {patientDetailLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-medical-teal" />
                            </div>
                          ) : selectedPatient ? (
                            <div className="space-y-6">
                              <div className="flex items-start gap-4">
                                <Avatar className="h-16 w-16">
                                  <AvatarFallback className="text-lg bg-medical-teal/20 text-medical-teal">
                                    {selectedPatient.name.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div>
                                  <h3 className="text-lg font-medium">{selectedPatient.name}</h3>
                                  
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                                    <div>
                                      <span className="text-gray-500">Gender:</span>{" "}
                                      <span className="font-medium">{selectedPatient.gender}</span>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-500">Age:</span>{" "}
                                      <span className="font-medium">{calculateAge(selectedPatient.date_of_birth)} years</span>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-500">Phone:</span>{" "}
                                      <span className="font-medium">{selectedPatient.phone_number}</span>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-500">DOB:</span>{" "}
                                      <span className="font-medium">{formatDate(selectedPatient.date_of_birth)}</span>
                                    </div>
                                  </div>
                                  
                                  {selectedPatient.address && (
                                    <div className="mt-2 text-sm">
                                      <span className="text-gray-500">Address:</span>{" "}
                                      <span className="font-medium">{selectedPatient.address}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Consultation History</h4>
                                {selectedPatient.appointments && selectedPatient.appointments.length > 0 ? (
                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                    {selectedPatient.appointments.map((appt: any) => (
                                      <div key={appt.id} className="p-3 bg-gray-50 rounded-md">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center text-sm">
                                            <CalendarIcon className="h-4 w-4 mr-1 text-gray-500" />
                                            <span className="font-medium">{formatDate(appt.appointment_date)}</span>
                                            <span className="mx-1 text-gray-400">•</span>
                                            <span>{formatTime(appt.appointment_date)}</span>
                                          </div>
                                          
                                          <Badge variant={
                                            appt.status === 'completed' ? 'outline' : 
                                            appt.status === 'confirmed' ? 'secondary' : 'default'
                                          }>
                                            {appt.status}
                                          </Badge>
                                        </div>
                                        
                                        {appt.notes && (
                                          <p className="text-sm mt-2 text-gray-600">{appt.notes}</p>
                                        )}
                                        
                                        {appt.status === 'confirmed' && (
                                          <div className="mt-3">
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              className="text-medical-teal"
                                              onClick={() => startConsultation(appt)}
                                            >
                                              {appt.consultation_type === 'voice' || appt.consultation_type === 'phone' ? (
                                                <>
                                                  <Phone className="h-3 w-3 mr-1" />
                                                  Join Voice Call
                                                </>
                                              ) : (
                                                <>
                                                  <Video className="h-3 w-3 mr-1" />
                                                  Join Video Call
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No consultation records found
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              Failed to load patient details. Please try again.
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Payment History Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <CreditCard className="h-5 w-5 mr-2 text-medical-teal" />
                      Payment History
                    </CardTitle>
                    <CardDescription>
                      Track payments and earnings from your consultations
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetchPaymentHistory();
                      fetchPaymentStats();
                    }}
                    disabled={loadingPayments}
                    className="text-medical-teal border-medical-teal hover:bg-medical-teal/10"
                  >
                    {loadingPayments ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Payment Statistics */}
                {paymentStats && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-green-600 font-medium">Total Earnings</p>
                            <h3 className="text-lg font-bold text-green-800 mt-1">
                              {formatAmount(paymentStats.total_earnings || 0)}
                            </h3>
                          </div>
                          <div className="bg-green-100 p-2 rounded-full">
                            <DollarSign className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-600 font-medium">On Hold</p>
                            <h3 className="text-lg font-bold text-blue-800 mt-1">
                              {formatAmount(paymentStats.on_hold_amount || 0)}
                            </h3>
                          </div>
                          <div className="bg-blue-100 p-2 rounded-full">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-amber-600 font-medium">Pending</p>
                            <h3 className="text-lg font-bold text-amber-800 mt-1">
                              {formatAmount(paymentStats.pending_amount || 0)}
                            </h3>
                          </div>
                          <div className="bg-amber-100 p-2 rounded-full">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-50 border-gray-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 font-medium">Completed</p>
                            <h3 className="text-lg font-bold text-gray-800 mt-1">
                              {formatAmount(paymentStats.completed_amount || 0)}
                            </h3>
                          </div>
                          <div className="bg-gray-100 p-2 rounded-full">
                            <CheckCircle className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {/* Payment History List */}
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-medical-teal" />
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No payment records</h3>
                    <p className="text-gray-500 mt-1">You have no payment transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-900">Recent Transactions</h4>
                      <span className="text-sm text-gray-500">{paymentHistory.length} transactions</span>
                    </div>
                    
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {paymentHistory.map((payment) => (
                        <Card key={payment.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-medical-teal/20 text-medical-teal text-sm">
                                      {payment.patient_name?.split(' ').map((n: string) => n[0]).join('') || 'P'}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div>
                                    <h5 className="font-medium text-gray-900 text-sm">
                                      {payment.patient_name || 'Unknown Patient'}
                                    </h5>
                                    <p className="text-xs text-gray-500">
                                      {payment.appointment_details?.reason || 'Consultation'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <div className="flex items-center">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    {payment.appointment_details?.appointment_date 
                                      ? formatDate(payment.appointment_details.appointment_date)
                                      : formatDate(payment.created_at)}
                                  </div>
                                  
                                  <div className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {payment.appointment_details?.appointment_date 
                                      ? formatTime(payment.appointment_details.appointment_date)
                                      : formatTime(payment.created_at)}
                                  </div>
                                  
                                  <div className="flex items-center">
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {payment.payment_method || 'Card'}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900 mb-1">
                                  {formatAmount(payment.amount)}
                                </div>
                                
                                <Badge variant={getPaymentStatusVariant(payment.payment_status)} className="text-xs">
                                  {formatPaymentStatus(payment.payment_status)}
                                </Badge>
                                
                                {payment.transaction_id && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    ID: {payment.transaction_id.slice(-8)}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Additional Payment Details */}
                            {payment.appointment_details?.status === 'completed' && payment.payment_status === 'hold' && (
                              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                <p className="text-xs text-amber-800">
                                  <AlertCircle className="h-3 w-3 inline mr-1" />
                                  Payment is on hold. Will be released after consultation review.
                                </p>
                              </div>
                            )}
                            
                            {payment.appointment_details?.status === 'pending' && (
                              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-xs text-blue-800">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  Payment will be processed after consultation completion.
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Payment Info */}
                <div className="mt-6 bg-blue-50 p-4 rounded-md">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Payment Information:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Payments are held securely until consultation completion</li>
                        <li>Funds are released to your account after patient confirmation</li>
                        <li>Payment status updates automatically based on consultation progress</li>
                        <li>Contact support for any payment-related queries</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Appointment Notifications */}
      {showNotifications && (
        <AppointmentNotification 
          userRole="doctor" 
          onClose={() => setShowNotifications(false)} 
        />
      )}
      
      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog.isOpen} onOpenChange={(open) => !open && closeRejectionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this appointment request.
              This will be shared with the patient.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              value={rejectionDialog.reason}
              onChange={(e) => setRejectionDialog(prev => ({
                ...prev,
                reason: e.target.value
              }))}
              placeholder="Enter reason for declining..."
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRejectionDialog}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineAppointment}
              disabled={!rejectionDialog.reason.trim()}
            >
              Decline Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
};

export default DoctorDashboardNew; 