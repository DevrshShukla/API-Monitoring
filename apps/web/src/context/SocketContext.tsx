import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';
import { SOCKET_EVENTS } from '@api-monitoring/shared';

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeWorkspace } = useAuth();
  const { info, warning, error } = useToast();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !activeWorkspace) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Connect to /workspace namespace
    const socket = io('/workspace', {
      auth: {
        token,
        workspaceId: activeWorkspace.id,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO connected to workspace:', activeWorkspace.name);
    });

    socket.on(SOCKET_EVENTS.MONITOR_CHECK_COMPLETED, (data: any) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['monitor', data.monitorId] });
      queryClient.invalidateQueries({ queryKey: ['monitor-checks', data.monitorId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    });

    socket.on(SOCKET_EVENTS.MONITOR_STATUS_UPDATED, (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['monitor', data.monitorId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });

      if (data.status === 'down') {
        error('Monitor Down', `Monitor status changed from ${data.lastStatus} to DOWN`);
      } else if (data.status === 'degraded') {
        warning('Monitor Degraded', `Monitor status changed to DEGRADED`);
      } else if (data.status === 'operational') {
        info('Monitor Recovered', `Monitor is now OPERATIONAL`);
      }
    });

    socket.on(SOCKET_EVENTS.INCIDENT_CREATED, (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      error('Incident Triggered', data.title);
    });

    socket.on(SOCKET_EVENTS.INCIDENT_UPDATED, (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', data.incidentId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeWorkspace?.id, queryClient, info, warning, error]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  return useContext(SocketContext);
}
