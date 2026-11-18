import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api.js';
import { UserDto, WorkspaceDto, LoginInput, RegisterInput } from '@api-monitoring/shared';

interface AuthContextValue {
  user: UserDto | null;
  workspaces: WorkspaceDto[];
  activeWorkspace: WorkspaceDto | null;
  currentWorkspace: WorkspaceDto | null;
  setActiveWorkspace: (workspace: WorkspaceDto) => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceDto | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveWorkspace = useCallback((ws: WorkspaceDto) => {
    setActiveWorkspaceState(ws);
    localStorage.setItem('activeWorkspaceId', ws.id);
  }, []);

  const refetchUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.get('/auth/me');
      const userData = res.data.data.user;
      const wsList: WorkspaceDto[] = res.data.data.workspaces;

      setUser(userData);
      setWorkspaces(wsList);

      const savedWsId = localStorage.getItem('activeWorkspaceId');
      const found = wsList.find((w) => w.id === savedWsId) || wsList[0] || null;
      if (found) {
        setActiveWorkspaceState(found);
        localStorage.setItem('activeWorkspaceId', found.id);
      }
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('activeWorkspaceId');
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspaceState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  const login = async (input: LoginInput) => {
    const res = await apiClient.post('/auth/login', input);
    const { accessToken, refreshToken, user: u, workspace: ws } = res.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('activeWorkspaceId', ws.id);

    setUser(u);
    setActiveWorkspaceState(ws);
    await refetchUser();
  };

  const register = async (input: RegisterInput) => {
    const res = await apiClient.post('/auth/register', input);
    const { accessToken, refreshToken, user: u, workspace: ws } = res.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('activeWorkspaceId', ws.id);

    setUser(u);
    setActiveWorkspaceState(ws);
    await refetchUser();
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('activeWorkspaceId');
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        currentWorkspace: activeWorkspace,
        setActiveWorkspace,
        login,
        register,
        logout,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
