import React, { createContext, useState, useEffect } from 'react';

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIdentityReveal, setShowIdentityReveal] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedReason, setBannedReason] = useState('');
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [adminCsrfToken, _setAdminCsrfToken] = useState(() => localStorage.getItem('dseu_admin_csrf_token') || '');

  const setAdminCsrfToken = (token) => {
    _setAdminCsrfToken(token || '');
    if (token) {
      localStorage.setItem('dseu_admin_csrf_token', token);
    } else {
      localStorage.removeItem('dseu_admin_csrf_token');
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('dseu_unfiltered_token');
      const headers = {};
      if (token) {
        headers['x-anonymous-token'] = token;
      }
      
      const response = await fetch('/api/auth/me', { headers });
      
      if (response.status === 503) {
        const errorData = await response.json();
        if (errorData.error === 'MAINTENANCE_MODE') {
          setIsMaintenanceActive(true);
          setMaintenanceMessage(errorData.message);
          setLoading(false);
          return;
        }
      }

      if (response.status === 403) {
        const errorData = await response.json();
        setIsBanned(true);
        setBannedReason(errorData.message || 'Your identity has been permanently banned.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      
      // Determine if this is a first-time token creation
      // Check local storage to see if we've seen this user before.
      const localToken = localStorage.getItem('dseu_unfiltered_token');
      
      setUser(data.user);
      
      // Store token locally as a fallback
      localStorage.setItem('dseu_unfiltered_token', data.user.browserToken);

      if (localToken !== data.user.browserToken) {
        // Show "You are [Identity Name]" reveal screen for new tokens (or cleared data)
        setShowIdentityReveal(true);
        setTimeout(() => {
          setShowIdentityReveal(false);
        }, 2200);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching anonymous identity:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <UserContext.Provider value={{
      user,
      setUser,
      loading,
      showIdentityReveal,
      isBanned,
      bannedReason,
      isMaintenanceActive,
      setIsMaintenanceActive,
      maintenanceMessage,
      refreshProfile: fetchProfile,
      adminCsrfToken,
      setAdminCsrfToken
    }}>
      {children}
    </UserContext.Provider>
  );
}
