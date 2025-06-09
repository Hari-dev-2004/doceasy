import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_URL } from '@/config';
import authService from './authService';

// Create axios instance
const httpClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout for payment operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token and auto-refresh if needed
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Skip auth for public endpoints
      const publicEndpoints = [
        '/health',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify-otp',
        '/api/auth/resend-otp',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/verify-reset-token',
        '/api/auth/refresh-token',
        '/api/doctors', // public doctor list
      ];

      const isPublicEndpoint = publicEndpoints.some(endpoint => 
        config.url?.includes(endpoint)
      );

      if (!isPublicEndpoint && authService.isAuthenticated()) {
        // Auto-refresh token if needed (non-blocking)
        authService.autoRefreshIfNeeded().catch(error => {
          console.warn('Auto-refresh failed:', error);
        });

        // Get current token for the request
        const token = authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle auth errors and token refresh
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Check for token refresh suggestion header
    if (response.headers['x-token-refresh-suggested'] === 'true') {
      authService.autoRefreshIfNeeded().catch(error => {
        console.warn('Suggested token refresh failed:', error);
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors (Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const errorData = error.response.data as any;
      
      // Check if this is an expired token that can be refreshed
      if (errorData?.error_type === 'expired_token' || 
          errorData?.error_type === 'missing_token') {
        
        try {
          // Try to refresh the token
          const newToken = await authService.refreshToken();
          
          // Update the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          // Retry the original request
          return httpClient(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed during request retry:', refreshError);
          
          // If refresh fails, logout and redirect
          authService.logout();
          
          // Don't redirect if we're already on a login page
          if (!window.location.pathname.includes('/login')) {
            const userRole = localStorage.getItem('user_role') || 'patient';
            window.location.href = `/login/${userRole}`;
          }
          
          return Promise.reject(new Error('Session expired. Please login again.'));
        }
      }
    }

    // Handle other specific errors
    if (error.response?.status === 403) {
      return Promise.reject(new Error('Access denied. You do not have permission to perform this action.'));
    }

    if (error.response?.status === 404) {
      return Promise.reject(new Error('Resource not found.'));
    }

    if (error.response?.status >= 500) {
      return Promise.reject(new Error('Server error. Please try again later.'));
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }

    // Return the original error for other cases
    return Promise.reject(error);
  }
);

export default httpClient; 