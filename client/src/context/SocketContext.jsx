import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { UserContext } from './UserContext';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useContext(UserContext);
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Establish connection to backend port (proxied via Vite on localhost)
    // Note: In production (Render/Vercel), we can connect directly to the current host or empty string
    const socketInstance = io(window.location.origin === 'http://localhost:3000' ? 'http://localhost:5000' : window.location.origin, {
      transports: ['websocket'],
      autoConnect: true
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.IO connection established.');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket.IO connection disconnected.');
    });

    // Sync online count
    socketInstance.on('online-count', (count) => {
      setOnlineCount(count);
    });

    // Listen to admin slow-mode updates
    socketInstance.on('slow-mode-update', (seconds) => {
      setSlowModeSeconds(seconds);
    });

    // Listen to pinned announcements
    socketInstance.on('announcement-update', (text) => {
      setPinnedAnnouncement(text);
    });

    // Initial checks for slow mode or announcement on loading
    const fetchInitialSettings = async () => {
      try {
        // We can check these settings via fetch if we want, or just wait for socket sync.
        // Let's call general API in future, but Socket update is fine.
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialSettings();

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // When user state is loaded, register browser token to sync nickname
  useEffect(() => {
    if (socket && user?.browserToken) {
      socket.emit('register-identity', user.browserToken);
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      onlineCount,
      slowModeSeconds,
      pinnedAnnouncement,
      setPinnedAnnouncement
    }}>
      {children}
    </SocketContext.Provider>
  );
}
