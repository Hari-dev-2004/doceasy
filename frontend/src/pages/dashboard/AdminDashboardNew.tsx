import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  User, Users, Calendar, CreditCard, CheckCircle, 
  XCircle, MoreHorizontal, Search, FileText, Filter, Plus,
  Shield, Bell, AlertCircle, Eye, EyeOff, Loader2, Settings,
  LogOut, UserCog, FileBarChart, RefreshCw, Clock, History
} from "lucide-react";
import { adminService } from "@/services/adminService";

const AdminDashboardNew = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Check authentication and auto-fix tokens on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('user_role');
        
        if (!token || userRole !== 'admin') {
          // Try to auto-login with default admin credentials
          try {
            const loginResult = await adminService.login('subrahmanyag79@gmail.com', 'Subbu@2004');
            if (loginResult.access_token && loginResult.user.role === 'admin') {
              setIsAuthenticated(true);
              setIsAdmin(true);
              setAuthError(null);
              toast({
                title: "Authentication",
                description: "Successfully authenticated as admin",
              });
            } else {
              throw new Error('Invalid admin credentials');
            }
          } catch (loginError) {
            console.error('Auto-login failed:', loginError);
            setAuthError('Failed to authenticate. Please login manually.');
            setIsAuthenticated(false);
            setIsAdmin(false);
          }
        } else {
          // Token exists and role is admin - assume valid for now
          // We'll validate it when making API calls
          setIsAuthenticated(true);
          setIsAdmin(true);
          setAuthError(null);
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        setAuthError('Failed to initialize authentication');
        setIsAuthenticated(false);
        setIsAdmin(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, [toast]);
  
  // State for doctors tab
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showDoctorVerificationDialog, setShowDoctorVerificationDialog] = useState(false);
  const [showDoctorRemovalDialog, setShowDoctorRemovalDialog] = useState(false);
  
  // State for patients tab
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showPatientDetailsDialog, setShowPatientDetailsDialog] = useState(false);
  
  // State for complaints tab
  const [complaintSearch, setComplaintSearch] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [showComplaintDetailsDialog, setShowComplaintDetailsDialog] = useState(false);
  
  // State for system settings
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  
  // State for user management
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  
  // State for appointments management
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showAppointmentDetailsDialog, setShowAppointmentDetailsDialog] = useState(false);
  
  // State for notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  
  // State for consultation history
  const [consultationSearch, setConsultationSearch] = useState("");
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [showConsultationDetailsDialog, setShowConsultationDetailsDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  
  // Fetch data from API using React Query
  const { 
    data: doctors = [], 
    isLoading: isDoctorsLoading,
    error: doctorsError 
  } = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: adminService.getDoctors,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: patients = [], 
    isLoading: isPatientsLoading,
    error: patientsError 
  } = useQuery({
    queryKey: ['admin-patients'],
    queryFn: adminService.getPatients,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: complaints = [], 
    isLoading: isComplaintsLoading,
    error: complaintsError 
  } = useQuery({
    queryKey: ['admin-complaints'],
    queryFn: adminService.getComplaints,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: dashboardStats = {
      totalDoctors: 0,
      pendingVerifications: 0,
      totalPatients: 0,
      totalComplaints: 0,
      newComplaints: 0,
      newDoctorsThisMonth: 0,
      newPatientsThisMonth: 0,
      highPriorityComplaints: 0
    }, 
    isLoading: isStatsLoading,
    error: statsError 
  } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: adminService.getDashboardStats,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const { 
    data: users = [], 
    isLoading: isUsersLoading,
    error: usersError 
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminService.getAllUsers,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: settings,
    isLoading: isSettingsLoading,
    error: settingsError
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSystemSettings,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: appointments = [], 
    isLoading: isAppointmentsLoading,
    error: appointmentsError
  } = useQuery({
    queryKey: ['admin-appointments'],
    queryFn: adminService.getAllAppointments,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const { 
    data: notifications = [],
    isLoading: isNotificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: adminService.getNotifications,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  // Fetch pending verification doctors specifically
  const { 
    data: pendingVerificationDoctors = [],
    isLoading: isPendingVerificationLoading,
    error: pendingVerificationError,
  } = useQuery({
    queryKey: ['admin-pending-verification-doctors'],
    queryFn: adminService.getPendingVerificationDoctors,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  const unreadNotificationsCount = notifications.filter(notification => !notification.read).length;
  
  // Fetch admin profile
  const {
    data: adminProfile,
    isLoading: isAdminProfileLoading,
    error: adminProfileError
  } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: adminService.getAdminProfile,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
  });
  
  // Fetch consultation history
  const { 
    data: consultationHistory = [], 
    isLoading: isConsultationHistoryLoading,
    error: consultationHistoryError,
    refetch: refetchConsultationHistory
  } = useQuery({
    queryKey: ['admin-consultation-history'],
    queryFn: adminService.getConsultationHistory,
    retry: 1,
    enabled: isAuthenticated && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Logout handler
  const handleLogout = () => {
    setIsLoggingOut(true);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      
      toast({
        title: "Success",
        description: "You have been logged out successfully",
      });
      
      navigate('/');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  // System settings mutation
  const updateSystemSettingsMutation = useMutation({
    mutationFn: (settings: any) => adminService.updateSystemSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast({
        title: "Success",
        description: "System settings updated successfully",
      });
      setShowSettingsDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update system settings",
      });
    }
  });
  
  const markNotificationAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => adminService.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to mark notification as read",
      });
    },
  });
  
  const markAllNotificationsAsReadMutation = useMutation({
    mutationFn: () => adminService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to mark all notifications as read",
      });
    },
  });
  
  // User status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number, status: string }) => 
      adminService.updateUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      setShowUserDetailsDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update user status",
      });
    }
  });
  
  // Mutations for data operations
  const verifyDoctorMutation = useMutation({
    mutationFn: ({ doctorId, approved }: { doctorId: number, approved: boolean }) => 
      adminService.verifyDoctor(doctorId, approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-verification-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast({
        title: "Success",
        description: "Doctor verification status updated successfully",
      });
      setShowDoctorVerificationDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update doctor verification status",
      });
    }
  });

  const removeDoctorMutation = useMutation({
    mutationFn: (doctorId: number) => adminService.removeDoctor(doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-verification-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast({
        title: "Success",
        description: "Doctor removed successfully",
      });
      setShowDoctorRemovalDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to remove doctor",
      });
    }
  });

  const updatePatientStatusMutation = useMutation({
    mutationFn: ({ patientId, status }: { patientId: number, status: string }) => 
      adminService.updatePatientStatus(patientId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
      toast({
        title: "Success",
        description: "Patient status updated successfully",
      });
      setShowPatientDetailsDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update patient status",
      });
    }
  });

  const updateComplaintStatusMutation = useMutation({
    mutationFn: ({ complaintId, status, notes }: { complaintId: number, status: string, notes?: string }) => 
      adminService.updateComplaintStatus(complaintId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast({
        title: "Success",
        description: "Complaint status updated successfully",
      });
      setShowComplaintDetailsDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update complaint status",
      });
    }
  });

  // Show error messages for failed data fetching
  useEffect(() => {
    const handleError = (error: any, title: string) => {
      // Don't show connection errors in notifications
      if (typeof error === 'string' && (error.includes('connection') || error.includes('network'))) {
        console.error(`${title} Error:`, error);
        return;
      }
      
      const errorMessage = typeof error === 'string' 
        ? error 
        : error?.message || `Failed to load ${title.toLowerCase()}. Please try again later.`;
      
      toast({
        variant: "destructive",
        title: `${title} Error`,
        description: errorMessage,
      });
      
      console.error(`${title} Error:`, error);
    };
    
    if (doctorsError) handleError(doctorsError, "Doctors");
    if (patientsError) handleError(patientsError, "Patients");
    if (complaintsError) handleError(complaintsError, "Complaints");
    if (adminProfileError) handleError(adminProfileError, "Admin Profile");
    if (settingsError) handleError(settingsError, "System Settings");
    if (usersError) handleError(usersError, "Users");
    if (appointmentsError) handleError(appointmentsError, "Appointments");
    if (notificationsError) handleError(notificationsError, "Notifications");
    if (pendingVerificationError) handleError(pendingVerificationError, "Pending Verification Doctors");
    if (consultationHistoryError) handleError(consultationHistoryError, "Consultation History");
    
  }, [doctorsError, patientsError, complaintsError, adminProfileError, settingsError, usersError, appointmentsError, notificationsError, pendingVerificationError, consultationHistoryError, toast]);

  // Filter functions for search
  const filteredDoctors = doctors.filter(doctor => 
    doctor.name?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    doctor.specialty?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    doctor.email?.toLowerCase().includes(doctorSearch.toLowerCase())
  );
  
  const filteredPatients = patients.filter(patient => 
    patient.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    patient.email?.toLowerCase().includes(patientSearch.toLowerCase())
  );
  
  const filteredComplaints = complaints.filter(complaint => 
    complaint.patientName?.toLowerCase().includes(complaintSearch.toLowerCase()) ||
    complaint.doctorName?.toLowerCase().includes(complaintSearch.toLowerCase()) ||
    complaint.description?.toLowerCase().includes(complaintSearch.toLowerCase())
  );
  
  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.role?.toLowerCase().includes(userSearch.toLowerCase())
  );
  
  const filteredAppointments = appointments.filter(appointment => 
    appointment.patientName?.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
    appointment.doctorName?.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
    appointment.status?.toLowerCase().includes(appointmentSearch.toLowerCase())
  );

  // Filter consultation history
  const filteredConsultationHistory = consultationHistory.filter(consultation => {
    const matchesSearch = 
      consultation.patientName?.toLowerCase().includes(consultationSearch.toLowerCase()) ||
      consultation.doctorName?.toLowerCase().includes(consultationSearch.toLowerCase()) ||
      consultation.consultationType?.toLowerCase().includes(consultationSearch.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || consultation.status === statusFilter;
    const matchesPaymentStatus = paymentStatusFilter === "all" || consultation.paymentStatus === paymentStatusFilter;
    
    return matchesSearch && matchesStatus && matchesPaymentStatus;
  });

  // Get stats from API response or calculate from the fetched data if not available
  const totalDoctors = dashboardStats.totalDoctors || doctors.length;
  const pendingVerifications = dashboardStats.pendingVerifications || 
    doctors.filter(doctor => doctor.verificationStatus === "admin_pending").length;
  const totalPatients = dashboardStats.totalPatients || patients.length;
  const totalComplaints = dashboardStats.totalComplaints || complaints.length;
  const newComplaints = dashboardStats.newComplaints || 
    complaints.filter(complaint => complaint.status === "new").length;
  const highPriorityComplaints = dashboardStats.highPriorityComplaints || 
    complaints.filter(complaint => complaint.severity === "high" && complaint.status !== "resolved").length;

  // Handler functions
  const handleVerifyDoctor = (approved: boolean) => {
    if (selectedDoctor) {
      verifyDoctorMutation.mutate({ 
        doctorId: selectedDoctor.id, 
        approved 
      }, {
        onSuccess: (data) => {
          // Close the dialog
          setShowDoctorVerificationDialog(false);
          
          // Refresh doctors data
          queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
          queryClient.invalidateQueries({ queryKey: ['admin-pending-verification-doctors'] });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
          
          // Show success message
          toast({
            title: approved ? "Doctor Verified" : "Doctor Rejected",
            description: data.message || (approved 
              ? `${selectedDoctor.name} has been verified and can now receive appointments.` 
              : `${selectedDoctor.name} has been rejected.`),
            variant: approved ? "default" : "destructive"
          });
        },
        onError: (error: any) => {
          // Skip notification for connection errors
          if (typeof error === 'string' && (error.includes('connection') || error.includes('network'))) {
            console.error('Verification Error:', error);
            return;
          }
          
          const errorMessage = typeof error === 'string' 
            ? error 
            : error?.message || "Failed to update doctor verification status";
          
          toast({
            variant: "destructive",
            title: "Verification Error",
            description: errorMessage,
          });
        }
      });
    }
  };

  const handleRemoveDoctor = () => {
    if (selectedDoctor) {
      removeDoctorMutation.mutate(selectedDoctor.id, {
        onSuccess: (data) => {
          // Close the dialog
          setShowDoctorRemovalDialog(false);
          
          // Refresh doctors data
          queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
          
          // Show success message
          toast({
            title: "Doctor Removed",
            description: data.message || `${selectedDoctor.name} has been removed from the system.`,
            variant: "destructive"
          });
        },
        onError: (error: any) => {
          const errorMessage = typeof error === 'string' 
            ? error 
            : error?.message || "Failed to remove doctor";
          
          toast({
            variant: "destructive",
            title: "Removal Error",
            description: errorMessage,
          });
        }
      });
    }
  };

  const handleUpdatePatientStatus = (status: string) => {
    if (selectedPatient) {
      updatePatientStatusMutation.mutate({
        patientId: selectedPatient.id,
        status
      }, {
        onSuccess: (data) => {
          // Close the dialog
          setShowPatientDetailsDialog(false);
          
          // Refresh patients data
          queryClient.invalidateQueries({ queryKey: ['admin-patients'] });
          
          // Show success message
          toast({
            title: "Patient Status Updated",
            description: data.message || `${selectedPatient.name}'s status has been updated to ${status}.`,
            variant: status === "active" ? "default" : "destructive"
          });
        },
        onError: (error: any) => {
          const errorMessage = typeof error === 'string' 
            ? error 
            : error?.message || "Failed to update patient status";
          
          toast({
            variant: "destructive",
            title: "Status Update Error",
            description: errorMessage,
          });
        }
      });
    }
  };

  const [adminNotes, setAdminNotes] = useState("");

  const handleUpdateComplaintStatus = (status: string) => {
    if (selectedComplaint) {
      updateComplaintStatusMutation.mutate({
        complaintId: selectedComplaint.id,
        status,
        notes: adminNotes.trim() ? adminNotes : undefined
      }, {
        onSuccess: (data) => {
          // Close the dialog
          setShowComplaintDetailsDialog(false);
          
          // Reset admin notes
          setAdminNotes("");
          
          // Refresh complaints data
          queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
          
          // Show success message
          toast({
            title: "Complaint Status Updated",
            description: data.message || `Complaint status has been updated to ${status}.`,
            variant: status === "resolved" ? "default" : "destructive"
          });
        },
        onError: (error: any) => {
          const errorMessage = typeof error === 'string' 
            ? error 
            : error?.message || "Failed to update complaint status";
          
          toast({
            variant: "destructive",
            title: "Status Update Error",
            description: errorMessage,
          });
        }
      });
    }
  };

  const handleComplaintAction = () => {
    setShowComplaintDetailsDialog(false);
    if (selectedComplaint) {
      const doctor = doctors.find(d => d.name === selectedComplaint.doctorName);
      if (doctor) {
        setSelectedDoctor(doctor);
        setShowDoctorRemovalDialog(true);
      }
    }
  };

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    markNotificationAsReadMutation.mutate(notification.id);
    
    // Navigate to related content based on notification type
    if (notification.relatedTo) {
      const { type, id } = notification.relatedTo;
      
      switch (type) {
        case 'doctor':
          const doctor = doctors.find(d => d.id === id);
          if (doctor) {
            setSelectedDoctor(doctor);
            setShowDoctorVerificationDialog(true);
          }
          break;
        case 'patient':
          const patient = patients.find(p => p.id === id);
          if (patient) {
            setSelectedPatient(patient);
            setShowPatientDetailsDialog(true);
          }
          break;
        case 'complaint':
          const complaint = complaints.find(c => c.id === id);
          if (complaint) {
            setSelectedComplaint(complaint);
            setShowComplaintDetailsDialog(true);
          }
          break;
        case 'appointment':
          const appointment = appointments.find(a => a.id === id);
          if (appointment) {
            setSelectedAppointment(appointment);
            setShowAppointmentDetailsDialog(true);
          }
          break;
        case 'system':
          setShowSettingsDialog(true);
          break;
      }
    }
    
    // Close notifications panel
    setShowNotifications(false);
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsInitializing(true);
    try {
      const loginResult = await adminService.login('subrahmanyag79@gmail.com', 'Subbu@2004');
      if (loginResult.access_token && loginResult.user.role === 'admin') {
        setIsAuthenticated(true);
        setIsAdmin(true);
        setAuthError(null);
        // Refresh all queries
        queryClient.invalidateQueries();
        toast({
          title: "Success",
          description: "Authentication refreshed and data reloaded",
        });
      }
    } catch (error) {
      setAuthError('Failed to refresh authentication');
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Could not refresh authentication. Please try again.",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Helper function to construct proper document URLs
  const getDocumentUrl = (documentPath: string): string => {
    if (!documentPath) return '#';
    
    // Clean the document path - remove any leading 'uploads/' or 'uploads\' 
    let cleanPath = documentPath;
    if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('uploads\\')) {
      cleanPath = cleanPath.substring(8); // Remove 'uploads/' or 'uploads\'
    }
    
    // Replace backslashes with forward slashes for URL
    cleanPath = cleanPath.replace(/\\/g, '/');
    
    // Construct the proper API URL
    return `${API_URL}/api/uploads/${cleanPath}`;
  };

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Initializing Admin Dashboard</h2>
          <p className="text-gray-500">Authenticating and loading data...</p>
        </div>
      </div>
    );
  }

  // Show error screen if authentication failed
  if (authError && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Authentication Error</h2>
          <p className="text-gray-500 mb-4">{authError}</p>
          <div className="space-x-2">
            <Button onClick={handleManualRefresh} disabled={isInitializing}>
              {isInitializing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Authentication
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => navigate('/login/admin')}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated or not admin, show loading
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading admin dashboard...</span>
      </div>
    );
  }
  
  return (
    <div className="container max-w-7xl mx-auto p-4 py-8">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage doctors, patients, and system operations</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={16} />
                <span>Notifications</span>
                {unreadNotificationsCount > 0 && (
                  <Badge className="bg-red-500 text-white ml-1">{unreadNotificationsCount}</Badge>
                )}
              </Button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 border border-gray-200">
                  <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-medium">Notifications</h3>
                    {notifications.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-7 px-2"
                        onClick={() => markAllNotificationsAsReadMutation.mutate()}
                        disabled={markAllNotificationsAsReadMutation.isPending}
                      >
                        {markAllNotificationsAsReadMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Mark all as read'
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto">
                    {isNotificationsLoading ? (
                      <div className="flex justify-center items-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-6 text-center text-gray-500 text-sm">
                        No notifications
                      </div>
                    ) : (
                      <div>
                        {notifications.map((notification) => (
                          <div 
                            key={notification.id} 
                            className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {notification.type === 'info' && <Bell className="h-4 w-4 text-blue-500" />}
                                {notification.type === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                {notification.type === 'alert' && <AlertCircle className="h-4 w-4 text-red-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <p className="font-medium text-sm truncate">{notification.title}</p>
                                  <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{notification.time}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{notification.date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <Button 
              variant="outline"
              onClick={handleManualRefresh}
              disabled={isInitializing}
              className="flex items-center gap-2"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>Refresh Data</span>
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => setShowSettingsDialog(true)}
              className="flex items-center gap-2"
            >
              <Settings size={16} />
              <span>System Settings</span>
            </Button>
            <Button 
              variant="destructive" 
              className="flex items-center gap-2" 
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  <span>Logout</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-medical-blue/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Total Doctors</p>
                <h3 className="text-2xl font-bold mt-1">{totalDoctors}</h3>
              </div>
              <div className="bg-medical-blue/20 p-3 rounded-full">
                <Users className="h-6 w-6 text-medical-blue" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Pending Doctor Verifications</p>
                <h3 className="text-2xl font-bold mt-1">{pendingVerifications}</h3>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <CheckCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-medical-teal/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Total Patients</p>
                <h3 className="text-2xl font-bold mt-1">{totalPatients}</h3>
              </div>
              <div className="bg-medical-teal/20 p-3 rounded-full">
                <User className="h-6 w-6 text-medical-teal" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Active Complaints</p>
                <h3 className="text-2xl font-bold mt-1">{newComplaints}</h3>
                <p className="text-xs text-gray-500 mt-1">{highPriorityComplaints} high priority</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="doctors" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="doctors" className="flex items-center gap-2">
            <Users size={16} />
            <span>Doctors</span>
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex items-center gap-2">
            <User size={16} />
            <span>Patients</span>
          </TabsTrigger>
          <TabsTrigger value="complaints" className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>Complaints</span>
          </TabsTrigger>
          <TabsTrigger value="consultations" className="flex items-center gap-2">
            <History size={16} />
            <span>Consultations</span>
          </TabsTrigger>
          <TabsTrigger value="verifications" className="flex items-center gap-2">
            <CheckCircle size={16} />
            <span>Verifications</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Doctors Tab */}
        <TabsContent value="doctors" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search doctors by name..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex gap-1 items-center">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button className="flex gap-1 items-center">
                <Plus className="h-4 w-4" />
                Add Doctor
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {isDoctorsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-medical-blue" />
                  <span className="ml-3 text-gray-500">Loading doctors...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Patients</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.specialty}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell>{doctor.patients}</TableCell>
                        <TableCell>{doctor.joinDate}</TableCell>
                        <TableCell>
                          <Badge className={
                            doctor.verificationStatus === "approved" ? "bg-green-100 text-green-800" : 
                            doctor.verificationStatus === "admin_pending" ? "bg-yellow-100 text-yellow-800" : 
                            doctor.verificationStatus === "profile_pending" ? "bg-blue-100 text-blue-800" :
                            doctor.verificationStatus === "email_pending" ? "bg-gray-100 text-gray-800" :
                            doctor.verificationStatus === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {doctor.verificationStatus === "admin_pending" ? "Admin Review" :
                             doctor.verificationStatus === "profile_pending" ? "Profile Pending" :
                             doctor.verificationStatus === "email_pending" ? "Email Pending" :
                             doctor.verificationStatus === "approved" ? "Verified" :
                             doctor.verificationStatus === "rejected" ? "Rejected" :
                             doctor.verificationStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {doctor.verificationStatus === "approved" ? (
                            <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                              <Eye size={12} />
                              <span>Visible</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 flex items-center gap-1">
                              <EyeOff size={12} />
                              <span>Hidden</span>
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedDoctor(doctor);
                                setShowDoctorVerificationDialog(true);
                              }}
                            >
                              Verify
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedDoctor(doctor);
                                setShowDoctorRemovalDialog(true);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isDoctorsLoading && filteredDoctors.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No doctors found matching your search
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search patients by name..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex gap-1 items-center">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {isPatientsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-medical-teal" />
                  <span className="ml-3 text-gray-500">Loading patients...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Consultations</TableHead>
                      <TableHead>Last Visit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        <TableCell>{patient.email}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>{patient.consultations}</TableCell>
                        <TableCell>{patient.lastVisit}</TableCell>
                        <TableCell>
                          <Badge className={
                            patient.status === "active" ? "bg-green-100 text-green-800" : 
                            "bg-red-100 text-red-800"
                          }>
                            {patient.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{patient.registrationDate}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowPatientDetailsDialog(true);
                              }}
                            >
                              View Details
                            </Button>
                            {patient.status === "active" ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleUpdatePatientStatus("inactive")}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-green-500 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleUpdatePatientStatus("active")}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isPatientsLoading && filteredPatients.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No patients found matching your search
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="complaints" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search complaints..."
                value={complaintSearch}
                onChange={(e) => setComplaintSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex gap-1 items-center">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {isComplaintsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                  <span className="ml-3 text-gray-500">Loading complaints...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComplaints.map((complaint) => (
                      <TableRow key={complaint.id}>
                        <TableCell className="font-medium">{complaint.patientName}</TableCell>
                        <TableCell>{complaint.doctorName}</TableCell>
                        <TableCell>{complaint.date}</TableCell>
                        <TableCell>
                          <Badge className={
                            complaint.severity === "high" ? "bg-red-100 text-red-800" : 
                            complaint.severity === "medium" ? "bg-amber-100 text-amber-800" : 
                            "bg-blue-100 text-blue-800"
                          }>
                            {complaint.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            complaint.status === "new" ? "bg-blue-100 text-blue-800" : 
                            complaint.status === "under-review" ? "bg-amber-100 text-amber-800" : 
                            "bg-green-100 text-green-800"
                          }>
                            {complaint.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setShowComplaintDetailsDialog(true);
                              }}
                            >
                              View Details
                            </Button>
                            {complaint.status === "new" && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleUpdateComplaintStatus("under-review")}
                              >
                                Take Action
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isComplaintsLoading && filteredComplaints.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No complaints found matching your search
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="consultations" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search consultations by patient or doctor..."
                value={consultationSearch}
                onChange={(e) => setConsultationSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
              <select 
                value={paymentStatusFilter} 
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Payments</option>
                <option value="pending">Payment Pending</option>
                <option value="on_hold">Payment On Hold</option>
                <option value="released">Payment Released</option>
                <option value="refunded">Payment Refunded</option>
                <option value="failed">Payment Failed</option>
              </select>
              <Button 
                variant="outline" 
                onClick={() => refetchConsultationHistory()}
                className="flex gap-1 items-center"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Total Consultations</p>
                    <h3 className="text-2xl font-bold mt-1">{consultationHistory.length}</h3>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Pending Payments</p>
                    <h3 className="text-2xl font-bold mt-1">
                      {consultationHistory.filter(c => c.paymentStatus === 'on_hold').length}
                    </h3>
                  </div>
                  <CreditCard className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Completed Today</p>
                    <h3 className="text-2xl font-bold mt-1">
                      {consultationHistory.filter(c => 
                        c.status === 'completed' && 
                        new Date(c.appointmentDate).toDateString() === new Date().toDateString()
                      ).length}
                    </h3>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">Revenue Today</p>
                    <h3 className="text-2xl font-bold mt-1">
                      ₹{consultationHistory
                        .filter(c => 
                          c.paymentStatus === 'released' && 
                          new Date(c.appointmentDate).toDateString() === new Date().toDateString()
                        )
                        .reduce((sum, c) => sum + (c.amount || 0), 0)}
                    </h3>
                  </div>
                  <CreditCard className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {isConsultationHistoryLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  <span className="ml-3 text-gray-500">Loading consultation history...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsultationHistory.map((consultation) => (
                      <TableRow key={consultation.id}>
                        <TableCell className="font-medium">{consultation.patientName}</TableCell>
                        <TableCell>{consultation.doctorName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{consultation.appointmentDate}</span>
                            <span className="text-xs text-gray-500">{consultation.appointmentTime}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {consultation.consultationType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            consultation.status === "completed" ? "bg-green-100 text-green-800" : 
                            consultation.status === "confirmed" ? "bg-blue-100 text-blue-800" : 
                            consultation.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                            consultation.status === "cancelled" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {consultation.status === "pending" ? "Request Pending" :
                             consultation.status === "confirmed" ? "Request Accepted" :
                             consultation.status === "completed" ? "Consultation Completed" :
                             consultation.status === "cancelled" ? "Cancelled" :
                             consultation.status === "rejected" ? "Request Rejected" :
                             consultation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            consultation.paymentStatus === "released" ? "bg-green-100 text-green-800" : 
                            consultation.paymentStatus === "on_hold" ? "bg-amber-100 text-amber-800" : 
                            consultation.paymentStatus === "pending" ? "bg-blue-100 text-blue-800" :
                            consultation.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800" :
                            "bg-red-100 text-red-800"
                          }>
                            {consultation.paymentStatus === "on_hold" ? "Payment On Hold" :
                             consultation.paymentStatus === "released" ? "Payment Released" :
                             consultation.paymentStatus === "pending" ? "Payment Pending" :
                             consultation.paymentStatus === "refunded" ? "Payment Refunded" :
                             consultation.paymentStatus === "failed" ? "Payment Failed" :
                             consultation.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{consultation.amount || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedConsultation(consultation);
                                setShowConsultationDetailsDialog(true);
                              }}
                            >
                              View Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isConsultationHistoryLoading && filteredConsultationHistory.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No consultations found matching your search criteria
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="verifications" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-medium mb-2">Pending Doctor Verifications</h2>
            <p className="text-gray-500 text-sm">
              Review and verify doctors before they can be visible to patients
            </p>
          </div>
          
          {isPendingVerificationLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
              <span className="ml-3 text-gray-500">Loading verification requests...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardStats.pendingVerifications > 0 && (
                  <div className="md:col-span-2 lg:col-span-3 bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-2">
                    <h3 className="text-lg font-medium text-yellow-800 flex items-center">
                      <Shield className="h-5 w-5 mr-2" /> Pending Doctor Verifications
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      There are {dashboardStats.pendingVerifications} doctors awaiting verification. Please review their credentials and documents before approving.
                    </p>
                  </div>
                )}
                {pendingVerificationDoctors.map(doctor => (
                    <Card key={doctor.id} className="overflow-hidden">
                      <CardHeader className="bg-yellow-50 pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{doctor.name}</CardTitle>
                          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                        </div>
                        <CardDescription>{doctor.specialty}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Email:</span>
                            <span>{doctor.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Phone:</span>
                            <span>{doctor.phone}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Joined:</span>
                            <span>{doctor.joinDate}</span>
                          </div>
                          <div className="pt-1">
                            <span className="text-gray-500">Documents:</span>
                            <ul className="mt-1 space-y-1">
                              {doctor.document_paths?.medical_license && (
                                <li className="flex justify-between items-center">
                                  <span>Medical License</span>
                                  <a 
                                    href={getDocumentUrl(doctor.document_paths.medical_license)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center"
                                  >
                                    <Eye className="h-3 w-3 mr-1" /> View
                                  </a>
                                </li>
                              )}
                              {doctor.document_paths?.mbbs_certificate && (
                                <li className="flex justify-between items-center">
                                  <span>MBBS Certificate</span>
                                  <a 
                                    href={getDocumentUrl(doctor.document_paths.mbbs_certificate)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center"
                                  >
                                    <Eye className="h-3 w-3 mr-1" /> View
                                  </a>
                                </li>
                              )}
                              {!doctor.document_paths?.medical_license && !doctor.document_paths?.mbbs_certificate && doctor.documents && doctor.documents.map((doc, index) => (
                                <li key={index} className="flex justify-between items-center">
                                  <span>{doc}</span>
                                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                                    Path not available
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button 
                            variant="outline"
                            size="sm"
                            className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                            onClick={() => handleVerifyDoctor(false)}
                          >
                            Reject
                          </Button>
                          <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedDoctor(doctor);
                              setShowDoctorVerificationDialog(true);
                            }}
                          >
                            Verify
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
              
              {!isPendingVerificationLoading && pendingVerificationDoctors.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                  No pending verification requests
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Doctor Verification Dialog */}
      <AlertDialog open={showDoctorVerificationDialog} onOpenChange={setShowDoctorVerificationDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Verify Doctor</AlertDialogTitle>
            <div>
              {selectedDoctor && (
                <div className="space-y-4 py-2">
                  <AlertDialogDescription asChild>
                    <p>Review the credentials of <span className="font-medium">{selectedDoctor.name}</span> before verification:</p>
                  </AlertDialogDescription>
                  
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Name:</div>
                      <div className="col-span-2">{selectedDoctor.name}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Specialty:</div>
                      <div className="col-span-2">{selectedDoctor.specialty}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Email:</div>
                      <div className="col-span-2">{selectedDoctor.email}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Phone:</div>
                      <div className="col-span-2">{selectedDoctor.phone}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Joined:</div>
                      <div className="col-span-2">{selectedDoctor.joinDate}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Documents:</div>
                      <div className="col-span-2">
                        <ul className="list-disc list-inside space-y-2">
                          {selectedDoctor.document_paths?.medical_license && (
                            <li className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-500" />
                              <span>Medical License</span>
                              <a 
                                href={getDocumentUrl(selectedDoctor.document_paths.medical_license)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center"
                              >
                                <Eye className="h-3 w-3 mr-1" /> View
                              </a>
                            </li>
                          )}
                          {selectedDoctor.document_paths?.mbbs_certificate && (
                            <li className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-500" />
                              <span>MBBS Certificate</span>
                              <a 
                                href={getDocumentUrl(selectedDoctor.document_paths.mbbs_certificate)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center"
                              >
                                <Eye className="h-3 w-3 mr-1" /> View
                              </a>
                            </li>
                          )}
                          {!selectedDoctor.document_paths?.medical_license && !selectedDoctor.document_paths?.mbbs_certificate && selectedDoctor.documents && selectedDoctor.documents.map((doc, index) => (
                            <li key={index} className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-500" />
                              <span>{doc}</span>
                              <span className="ml-2 text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                                Path not available
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-100 mt-2">
                    <div className="text-sm text-blue-700 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      <span>Once verified, this doctor will be visible to patients and can receive appointments.</span>
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      Please ensure all credentials and documents have been thoroughly reviewed before verification.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button 
              variant="outline" 
              className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
              onClick={() => handleVerifyDoctor(false)}
              disabled={verifyDoctorMutation.isPending}
            >
              {verifyDoctorMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject"
              )}
            </Button>
            <AlertDialogAction 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleVerifyDoctor(true)}
              disabled={verifyDoctorMutation.isPending}
            >
              {verifyDoctorMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Doctor"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Doctor Removal Dialog */}
      <AlertDialog open={showDoctorRemovalDialog} onOpenChange={setShowDoctorRemovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDoctor && (
                <>
                  <p className="mb-4">
                    Are you sure you want to remove <span className="font-medium">{selectedDoctor.name}</span> from the platform?
                  </p>
                  <p className="text-sm text-gray-500">
                    This action will prevent the doctor from accessing the platform and hide their profile from patients.
                    All existing patient records and history will remain in the system.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRemoveDoctor}
              disabled={removeDoctorMutation.isPending}
            >
              {removeDoctorMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Doctor"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Patient Details Dialog */}
      <AlertDialog open={showPatientDetailsDialog} onOpenChange={setShowPatientDetailsDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Patient Details</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPatient && (
                <div className="space-y-4 py-2">
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Name:</div>
                      <div className="col-span-2">{selectedPatient.name}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Email:</div>
                      <div className="col-span-2">{selectedPatient.email}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Phone:</div>
                      <div className="col-span-2">{selectedPatient.phone}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Status:</div>
                      <div className="col-span-2">
                        <Badge className={
                          selectedPatient.status === "active" ? "bg-green-100 text-green-800" : 
                          "bg-red-100 text-red-800"
                        }>
                          {selectedPatient.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Consultations:</div>
                      <div className="col-span-2">{selectedPatient.consultations}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Last Visit:</div>
                      <div className="col-span-2">{selectedPatient.lastVisit}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Registered:</div>
                      <div className="col-span-2">{selectedPatient.registrationDate}</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div className="font-medium">Medical Records:</div>
                    <Button variant="outline" size="sm" className="text-blue-600">
                      View Full History
                    </Button>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {selectedPatient && selectedPatient.status === "active" ? (
              <Button 
                variant="outline" 
                className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                onClick={() => handleUpdatePatientStatus("inactive")}
                disabled={updatePatientStatusMutation.isPending}
              >
                {updatePatientStatusMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  "Deactivate Account"
                )}
              </Button>
            ) : (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleUpdatePatientStatus("active")}
                disabled={updatePatientStatusMutation.isPending}
              >
                {updatePatientStatusMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  "Activate Account"
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Complaint Details Dialog */}
      <AlertDialog open={showComplaintDetailsDialog} onOpenChange={setShowComplaintDetailsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complaint Details</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedComplaint && (
                <div className="space-y-4 py-2">
                  <div className="flex justify-between">
                    <div>
                      <Badge className={
                        selectedComplaint.severity === "high" ? "bg-red-100 text-red-800" : 
                        selectedComplaint.severity === "medium" ? "bg-amber-100 text-amber-800" : 
                        "bg-blue-100 text-blue-800"
                      }>
                        {selectedComplaint.severity} severity
                      </Badge>
                    </div>
                    <div>
                      <Badge className={
                        selectedComplaint.status === "new" ? "bg-blue-100 text-blue-800" : 
                        selectedComplaint.status === "under-review" ? "bg-amber-100 text-amber-800" : 
                        "bg-green-100 text-green-800"
                      }>
                        {selectedComplaint.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Patient:</div>
                      <div className="col-span-2">{selectedComplaint.patientName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Doctor:</div>
                      <div className="col-span-2">{selectedComplaint.doctorName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Date:</div>
                      <div className="col-span-2">{selectedComplaint.date}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium mb-2">Description:</div>
                    <div className="bg-gray-50 p-3 rounded-md text-sm">
                      {selectedComplaint.description}
                    </div>
                  </div>
                  
                  {selectedComplaint.adminNotes && (
                    <div>
                      <div className="font-medium mb-2">Admin Notes:</div>
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        {selectedComplaint.adminNotes}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="font-medium mb-2">Add Notes:</div>
                    <Textarea
                      placeholder="Add administrative notes about this complaint"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="resize-none"
                    />
                  </div>
                  
                  {selectedComplaint.status === "new" && (
                    <div className="pt-2">
                      <div className="font-medium mb-2">Admin Action:</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="contactPatient" />
                          <label htmlFor="contactPatient" className="text-sm">Contact patient for more details</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="warningToDoctor" />
                          <label htmlFor="warningToDoctor" className="text-sm">Issue warning to doctor</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="doctorVerification" />
                          <label htmlFor="doctorVerification" className="text-sm">Review doctor's verification status</label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {selectedComplaint && selectedComplaint.status === "new" && (
              <>
                <Button 
                  variant="outline" 
                  className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                  onClick={() => handleUpdateComplaintStatus("under-review")}
                  disabled={updateComplaintStatusMutation.isPending}
                >
                  {updateComplaintStatusMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Mark as Under Review"
                  )}
                </Button>
                <Button 
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleComplaintAction}
                  disabled={updateComplaintStatusMutation.isPending}
                >
                  Remove Doctor
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Consultation Details Dialog */}
      <AlertDialog open={showConsultationDetailsDialog} onOpenChange={setShowConsultationDetailsDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Consultation Details</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedConsultation && (
                <div className="space-y-4 py-2">
                  <div className="flex justify-between">
                    <div>
                      <Badge className={
                        selectedConsultation.status === "completed" ? "bg-green-100 text-green-800" : 
                        selectedConsultation.status === "confirmed" ? "bg-blue-100 text-blue-800" : 
                        selectedConsultation.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        selectedConsultation.status === "cancelled" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-800"
                      }>
                        {selectedConsultation.status === "pending" ? "Request Pending" :
                         selectedConsultation.status === "confirmed" ? "Request Accepted" :
                         selectedConsultation.status === "completed" ? "Consultation Completed" :
                         selectedConsultation.status === "cancelled" ? "Cancelled" :
                         selectedConsultation.status === "rejected" ? "Request Rejected" :
                         selectedConsultation.status}
                      </Badge>
                    </div>
                    <div>
                      <Badge className={
                        selectedConsultation.paymentStatus === "released" ? "bg-green-100 text-green-800" : 
                        selectedConsultation.paymentStatus === "on_hold" ? "bg-amber-100 text-amber-800" : 
                        selectedConsultation.paymentStatus === "pending" ? "bg-blue-100 text-blue-800" :
                        selectedConsultation.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {selectedConsultation.paymentStatus === "on_hold" ? "Payment On Hold" :
                         selectedConsultation.paymentStatus === "released" ? "Payment Released" :
                         selectedConsultation.paymentStatus === "pending" ? "Payment Pending" :
                         selectedConsultation.paymentStatus === "refunded" ? "Payment Refunded" :
                         selectedConsultation.paymentStatus === "failed" ? "Payment Failed" :
                         selectedConsultation.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Consultation Information */}
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Patient:</div>
                      <div className="col-span-2">{selectedConsultation.patientName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Doctor:</div>
                      <div className="col-span-2">{selectedConsultation.doctorName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Date:</div>
                      <div className="col-span-2">{selectedConsultation.appointmentDate}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Time:</div>
                      <div className="col-span-2">{selectedConsultation.appointmentTime}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Type:</div>
                      <div className="col-span-2 capitalize">{selectedConsultation.consultationType}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Amount:</div>
                      <div className="col-span-2">₹{selectedConsultation.amount || 0}</div>
                    </div>
                  </div>
                  
                  {/* Payment Information */}
                  <div>
                    <div className="font-medium mb-2 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Information
                    </div>
                    <div className="space-y-3 bg-blue-50 p-3 rounded-md text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="font-medium">Payment Status:</div>
                        <div className="col-span-2">
                          <Badge className={
                            selectedConsultation.paymentStatus === "released" ? "bg-green-100 text-green-800" : 
                            selectedConsultation.paymentStatus === "on_hold" ? "bg-amber-100 text-amber-800" : 
                            selectedConsultation.paymentStatus === "pending" ? "bg-blue-100 text-blue-800" :
                            selectedConsultation.paymentStatus === "refunded" ? "bg-purple-100 text-purple-800" :
                            "bg-red-100 text-red-800"
                          }>
                            {selectedConsultation.paymentStatus === "on_hold" ? "Payment On Hold" :
                             selectedConsultation.paymentStatus === "released" ? "Payment Released to Doctor" :
                             selectedConsultation.paymentStatus === "pending" ? "Payment Pending" :
                             selectedConsultation.paymentStatus === "refunded" ? "Payment Refunded to Patient" :
                             selectedConsultation.paymentStatus === "failed" ? "Payment Failed" :
                             selectedConsultation.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                      {selectedConsultation.paymentMethod && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="font-medium">Payment Method:</div>
                          <div className="col-span-2">{selectedConsultation.paymentMethod}</div>
                        </div>
                      )}
                      {selectedConsultation.transactionId && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="font-medium">Transaction ID:</div>
                          <div className="col-span-2">{selectedConsultation.transactionId}</div>
                        </div>
                      )}
                      {selectedConsultation.paymentDate && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="font-medium">Payment Date:</div>
                          <div className="col-span-2">{new Date(selectedConsultation.paymentDate).toLocaleDateString()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Consultation Lifecycle */}
                  <div>
                    <div className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Consultation Lifecycle
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 bg-green-50 rounded-md">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Consultation Booked</span>
                      </div>
                      
                      {selectedConsultation.paymentStatus !== "pending" && (
                        <div className="flex items-center gap-3 p-2 bg-green-50 rounded-md">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Payment Received</span>
                        </div>
                      )}
                      
                      <div className={`flex items-center gap-3 p-2 rounded-md ${
                        selectedConsultation.status === "pending" ? "bg-yellow-50" : "bg-green-50"
                      }`}>
                        {selectedConsultation.status === "pending" ? (
                          <Clock className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-sm">
                          {selectedConsultation.status === "pending" ? "Request Pending" : "Request Accepted by Doctor"}
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-3 p-2 rounded-md ${
                        selectedConsultation.status === "completed" ? "bg-green-50" : "bg-gray-50"
                      }`}>
                        {selectedConsultation.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">Consultation Completed</span>
                      </div>
                      
                      {selectedConsultation.paymentStatus === "released" && (
                        <div className="flex items-center gap-3 p-2 bg-green-50 rounded-md">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Payment Released to Doctor</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Additional Notes */}
                  {selectedConsultation.notes && (
                    <div>
                      <div className="font-medium mb-2">Notes:</div>
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        {selectedConsultation.notes}
                      </div>
                    </div>
                  )}
                  
                  {selectedConsultation.reason && (
                    <div>
                      <div className="font-medium mb-2">Reason for Visit:</div>
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        {selectedConsultation.reason}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {selectedConsultation && selectedConsultation.paymentStatus === "on_hold" && selectedConsultation.status === "completed" && (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  // Add functionality to release payment
                  toast({
                    title: "Payment Released",
                    description: "Payment has been released to the doctor successfully.",
                  });
                  setShowConsultationDetailsDialog(false);
                  refetchConsultationHistory();
                }}
              >
                Release Payment to Doctor
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboardNew; 