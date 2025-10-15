// src/hooks/useAuth.ts
import { useAuthContext } from '../store/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};