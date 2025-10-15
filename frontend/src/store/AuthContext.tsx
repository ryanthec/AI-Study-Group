import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AuthState, User } from '../types/auth.types';
import { authService } from '../services/auth.service';
import toast from 'react-hot-toast';

// Auth Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' };

// Auth Context Type
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// Initial State
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Auth Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on app start
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');

      if (token) {
        try {
          dispatch({ type: 'AUTH_START' });
          const user = await authService.getCurrentUser();
          dispatch({ type: 'AUTH_SUCCESS', payload: user });
        } catch (error) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          dispatch({ type: 'AUTH_FAILURE', payload: 'Session expired' });
        }
      } else {
        dispatch({ type: 'AUTH_FAILURE', payload: '' });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await authService.login({ email, password });

      // Store tokens
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);

      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
      toast.success(`Welcome back, ${response.user.firstName}!`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  // Register function
  const register = async (userData: any) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await authService.register(userData);

      // Store tokens
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);

      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
      toast.success(`Welcome, ${response.user.firstName}! Your account has been created.`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};