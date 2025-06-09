import axios from 'axios';
import { API_URL } from '@/config';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'admin';
}

interface AuthResponse {
  access_token: string;
  user: User;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  exp: number;
}

class AuthService {
  private static instance: AuthService;
  private refreshPromise: Promise<string> | null = null;

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Token management
  public getToken(): string | null {
    return localStorage.getItem('token');
  }

  public setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  public removeToken(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
  }

  // User management
  public getUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  public setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user_role', user.role);
    localStorage.setItem('user_id', user.id);
  }

  // Token validation
  public isTokenValid(token?: string): boolean {
    const currentToken = token || this.getToken();
    if (!currentToken) return false;

    try {
      // Decode JWT payload (without verification for client-side check)
      const payload = JSON.parse(atob(currentToken.split('.')[1])) as TokenPayload;
      const now = Math.floor(Date.now() / 1000);
      
      // Check if token expires within next 5 minutes (300 seconds)
      return payload.exp > (now + 300);
    } catch {
      return false;
    }
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user && this.isTokenValid(token));
  }

  // Login
  public async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });

      const authResponse: AuthResponse = response.data;
      
      // Store authentication data
      this.setToken(authResponse.access_token);
      this.setUser(authResponse.user);

      return authResponse;
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.data?.requires_verification) {
        throw new Error('Please verify your email before logging in');
      }
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  // Logout
  public logout(): void {
    this.removeToken();
    window.location.href = '/';
  }

  // Refresh token using the backend endpoint
  public async refreshToken(): Promise<string> {
    // If already refreshing, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const token = this.getToken();
    if (!token) {
      throw new Error('No token available for refresh');
    }

    this.refreshPromise = this.performTokenRefresh(token);
    
    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(token: string): Promise<string> {
    try {
      const response = await axios.post(`${API_URL}/api/auth/refresh-token`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const newToken = response.data.access_token;
      const user = response.data.user;
      
      // Update stored data
      this.setToken(newToken);
      this.setUser(user);
      
      return newToken;
    } catch (error: any) {
      // If refresh fails, logout the user
      console.error('Token refresh failed:', error);
      this.logout();
      throw new Error('Session expired. Please login again.');
    }
  }

  // Get authentication headers
  public getAuthHeaders(): { Authorization?: string } {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Validate session before critical operations
  public async validateSession(): Promise<boolean> {
    const token = this.getToken();
    if (!token || !this.isTokenValid(token)) {
      return false;
    }

    try {
      // Test the token with the backend validation endpoint
      await axios.get(`${API_URL}/api/auth/validate-session`, {
        headers: this.getAuthHeaders()
      });
      return true;
    } catch (error: any) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  // Ensure valid session (refresh if needed)
  public async ensureValidSession(): Promise<string> {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    if (this.isTokenValid(token)) {
      return token;
    }

    // Token is expired or about to expire, try to refresh
    try {
      return await this.refreshToken();
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  // Check if token needs refresh (within 30 minutes of expiry)
  public shouldRefreshToken(token?: string): boolean {
    const currentToken = token || this.getToken();
    if (!currentToken) return false;

    try {
      const payload = JSON.parse(atob(currentToken.split('.')[1])) as TokenPayload;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      
      // Refresh if token expires within 30 minutes (1800 seconds)
      return timeUntilExpiry < 1800 && timeUntilExpiry > 0;
    } catch {
      return false;
    }
  }

  // Auto-refresh token if needed
  public async autoRefreshIfNeeded(): Promise<void> {
    const token = this.getToken();
    if (token && this.shouldRefreshToken(token)) {
      try {
        await this.refreshToken();
        console.log('Token auto-refreshed successfully');
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        // Don't throw error to avoid breaking user flow
      }
    }
  }
}

export const authService = AuthService.getInstance();
export default authService; 