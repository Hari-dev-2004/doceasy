import axios from "axios";
import { API_URL } from "@/config";

// Create axios instance with auth header
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 second timeout
});

// Add request interceptor to include auth token in all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      
      // Try to re-authenticate if we have the credentials
      try {
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
          email: 'subrahmanyag79@gmail.com',
          password: 'Subbu@2004'
        });
        
        if (loginResponse.data.access_token) {
          // Store new token
          localStorage.setItem('token', loginResponse.data.access_token);
          localStorage.setItem('user_role', loginResponse.data.user.role);
          localStorage.setItem('user_id', loginResponse.data.user.id);
          
          // Update the original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${loginResponse.data.access_token}`;
          
          // Retry the original request
          return api(originalRequest);
        }
      } catch (loginError) {
        console.error('Failed to re-authenticate:', loginError);
        // Redirect to login page
        window.location.href = '/login/admin';
        return Promise.reject(new Error('Authentication failed. Please login again.'));
      }
    }
    
    return Promise.reject(error);
  }
);

// Handle API errors consistently
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  let errorMessage = 'An unexpected error occurred';
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401) {
      errorMessage = 'Authentication failed. Please login again.';
    } else if (status === 403) {
      errorMessage = 'Access denied. Admin privileges required.';
    } else if (status === 404) {
      errorMessage = 'Resource not found.';
    } else if (status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else {
      errorMessage = data?.message || `Error: ${status}`;
    }
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'Connection error. Please check your internet connection.';
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message || 'Request failed';
  }
  
  return Promise.reject(errorMessage);
};

// Types
interface Doctor {
  id: string;
  name: string;
  specialty: string;
  patients: number;
  joinDate: string;
  verificationStatus: string;
  documents: string[];
  document_paths?: {
    medical_license?: string;
    mbbs_certificate?: string;
  };
  email: string;
  phone: string;
  bio?: string;
  consultationFee?: number;
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  consultations: number;
  lastVisit: string;
  status: string;
  registrationDate: string;
}

interface Complaint {
  id: number;
  patientName: string;
  doctorName: string;
  date: string;
  status: string;
  severity: string;
  description: string;
  adminNotes?: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  date: string;
  time: string;
  read: boolean;
  relatedTo?: {
    type: 'doctor' | 'patient' | 'complaint' | 'appointment' | 'system';
    id: number;
  };
}

interface ConsultationHistory {
  id: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: 'video' | 'chat' | 'phone';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  paymentStatus: 'pending' | 'on_hold' | 'released' | 'refunded' | 'failed';
  amount: number;
  reason?: string;
  notes?: string;
  paymentDate?: string;
  paymentMethod?: string;
  transactionId?: string;
}

interface PaymentHistory {
  id: number;
  appointmentId: number;
  patientName: string;
  doctorName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentStatus: 'hold' | 'approved' | 'released' | 'cancelled';
  transactionId: string;
  paymentDate: string;
  releaseDate?: string;
  adminApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

// Utility function to validate authentication
const validateAuth = () => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('user_role');
  
  if (!token || userRole !== 'admin') {
    throw new Error('Authentication required');
  }
  
  return token;
};

// Admin API services
export const adminService = {
  // Authentication check
  checkAuth: () => {
    try {
      return validateAuth();
    } catch (error) {
      return null;
    }
  },

  // Doctor management
  getDoctors: async (): Promise<Doctor[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/doctors`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  getPendingVerificationDoctors: async (): Promise<Doctor[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/doctors/pending-verification`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  verifyDoctor: async (doctorId: number, approved: boolean): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/doctors/${doctorId}/verify`, { approved });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  removeDoctor: async (doctorId: number): Promise<any> => {
    try {
      validateAuth();
      const response = await api.delete(`/api/admin/doctors/${doctorId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  getDoctorDetails: async (doctorId: number): Promise<any> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/doctors/${doctorId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Patient management
  getPatients: async (): Promise<Patient[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/patients`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  updatePatientStatus: async (patientId: number, status: string): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/patients/${patientId}/status`, { status });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  getPatientDetails: async (patientId: number): Promise<any> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/patients/${patientId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Complaint management
  getComplaints: async (): Promise<Complaint[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/complaints`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  updateComplaintStatus: async (complaintId: number, status: string, notes?: string): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/complaints/${complaintId}/status`, { 
        status, 
        notes 
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Dashboard statistics
  getDashboardStats: async (): Promise<any> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/dashboard/stats`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Additional admin functions
  getAdminProfile: async (): Promise<any> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/profile`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // System settings management
  getSystemSettings: async (): Promise<any> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/settings`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  updateSystemSettings: async (settings: any): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/settings`, settings);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // User management
  getAllUsers: async (): Promise<any[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/users`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  updateUserStatus: async (userId: number, status: string): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/users/${userId}/status`, { status });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Appointment management
  getAllAppointments: async (): Promise<any[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/appointments`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Consultation history management
  getConsultationHistory: async (): Promise<ConsultationHistory[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/consultations/history`);
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to get consultation history:', error);
      return []; // Return empty array on error
    }
  },

  // Payment history management
  getPaymentHistory: async (): Promise<PaymentHistory[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/payments`);
      
      // Transform the payment data to match our interface
      const payments = response.data.payments || response.data;
      return payments.map((payment: any) => ({
        id: payment.id,
        appointmentId: payment.appointment_id,
        patientName: payment.patient_name,
        doctorName: payment.doctor_name,
        amount: payment.amount,
        currency: payment.currency || 'INR',
        paymentMethod: payment.payment_method,
        status: payment.status,
        paymentStatus: payment.payment_status,
        transactionId: payment.transaction_id,
        paymentDate: payment.created_at,
        releaseDate: payment.release_date,
        adminApproved: payment.admin_approved,
        approvedBy: payment.approved_by,
        approvedAt: payment.approved_at
      }));
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Release payment to doctor
  releasePayment: async (paymentId: number): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/payments/${paymentId}/approve`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Notification management
  getNotifications: async (): Promise<Notification[]> => {
    try {
      validateAuth();
      const response = await api.get(`/api/admin/notifications`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  markNotificationAsRead: async (notificationId: number): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  markAllNotificationsAsRead: async (): Promise<any> => {
    try {
      validateAuth();
      const response = await api.put(`/api/admin/notifications/read-all`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Manual login function for debugging
  login: async (email: string, password: string): Promise<any> => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });
      
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user_role', response.data.user.role);
        localStorage.setItem('user_id', response.data.user.id);
      }
      
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Test connection
  testConnection: async (): Promise<any> => {
    try {
      const response = await axios.get(`${API_URL}/health`, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Connection test failed:', error);
      // More specific error handling for CORS and connection issues
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        throw new Error('Connection error. Please check if the backend server is running.');
      }
      return handleApiError(error);
    }
  },
};

export default adminService;