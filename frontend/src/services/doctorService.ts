import axios from "axios";
import { API_URL } from "@/config";

// Create axios instance with auth header
const api = axios.create({
  baseURL: API_URL,
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

// Handle API errors consistently
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  let errorMessage = 'An unexpected error occurred';
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    errorMessage = error.response.data?.message || `Error: ${error.response.status}`;
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'Connection error. Please try again later.';
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message;
  }
  
  return Promise.reject(errorMessage);
};

// Types
export interface Doctor {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  specialty: string;
  experience_years?: number;
  consultation_fee: number;
  bio?: string;
  profile_picture?: string;
}

// Doctor service - only returns approved doctors
export const doctorService = {
  // Get all approved doctors
  getDoctors: async (): Promise<Doctor[]> => {
    try {
      const response = await axios.get(`${API_URL}/api/doctors`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Get details of a specific doctor by ID
  getDoctorDetails: async (doctorId: string): Promise<Doctor> => {
    try {
      const response = await axios.get(`${API_URL}/api/doctors/${doctorId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  // Search for doctors by name or specialty
  searchDoctors: async (query: string, type: string = 'all'): Promise<{ exactMatch?: Doctor, doctors: Doctor[] }> => {
    try {
      // First get all doctors
      const allDoctors = await doctorService.getDoctors();
      
      // Check for exact matches based on search type
      let exactMatch: Doctor | undefined;
      let filteredDoctors: Doctor[] = [];
      
      if (type === 'name' || type === 'all') {
        // Look for exact name match (case insensitive)
        exactMatch = allDoctors.find(doctor => 
          doctor.name.toLowerCase() === query.toLowerCase()
        );
      }
      
      // Filter doctors based on search type
      switch (type) {
        case 'name':
          filteredDoctors = allDoctors.filter(doctor => 
            doctor.name.toLowerCase().includes(query.toLowerCase())
          );
          break;
        case 'specialty':
          filteredDoctors = allDoctors.filter(doctor => 
            doctor.specialty.toLowerCase().includes(query.toLowerCase())
          );
          break;
        case 'all':
        default:
          filteredDoctors = allDoctors.filter(doctor => 
            doctor.name.toLowerCase().includes(query.toLowerCase()) ||
            doctor.specialty.toLowerCase().includes(query.toLowerCase())
          );
      }
      
      return { exactMatch, doctors: filteredDoctors };
    } catch (error) {
      return handleApiError(error);
    }
  }
};

export default doctorService;
