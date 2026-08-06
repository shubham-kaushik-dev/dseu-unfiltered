import React, { createContext, useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || "";

// Override window.fetch globally to automatically include anonymous token fallback
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('dseu_unfiltered_token');
  const headers = { ...options.headers };

  if (token && !headers['x-anonymous-token']) {
    headers['x-anonymous-token'] = token;
  }

  return originalFetch(url, {
    ...options,
    headers
  });
};

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
  const [adminJwt, _setAdminJwt] = useState(() => localStorage.getItem('dseu_admin_jwt') || '');

  // Registration & login modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalCallback, setLoginModalCallback] = useState(null);

  const openLoginModal = (callback) => {
    setLoginModalCallback(() => callback);
    setShowLoginModal(true);
  };

  const onLoginSuccess = () => {
    setShowLoginModal(false);
    if (loginModalCallback) {
      loginModalCallback();
      setLoginModalCallback(null);
    }
  };

  const setAdminCsrfToken = (token) => {
    _setAdminCsrfToken(token || '');
    if (token) {
      localStorage.setItem('dseu_admin_csrf_token', token);
    } else {
      localStorage.removeItem('dseu_admin_csrf_token');
    }
  };

  const setAdminJwt = (token) => {
    _setAdminJwt(token || '');
    if (token) {
      localStorage.setItem('dseu_admin_jwt', token);
    } else {
      localStorage.removeItem('dseu_admin_jwt');
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('dseu_unfiltered_token');
      const adminJwtToken = adminJwt || localStorage.getItem('dseu_admin_jwt') || '';
      const headers = {};
      if (token) {
        headers['x-anonymous-token'] = token;
      }
      if (adminJwtToken) {
        headers['Authorization'] = `Bearer ${adminJwtToken}`;
      }
      
      const response = await fetch(`${API_BASE}/api/auth/me`, { headers });
      
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
      setIsBanned(data.user.isBanned || false);
      
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

  const logout = async () => {
    localStorage.removeItem('dseu_unfiltered_token');
    setUser(null);
    await fetchProfile();
  };

  const adminFetch = async (url, options = {}) => {
    const csrfToken = adminCsrfToken || localStorage.getItem('dseu_admin_csrf_token') || '';
    const jwtToken = adminJwt || localStorage.getItem('dseu_admin_jwt') || '';
    const headers = {
      ...options.headers,
      'x-csrf-token': csrfToken
    };

    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'ADMIN_SESSION_EXPIRED' || errorData.error === 'ADMIN_UNAUTHORIZED') {
          setAdminCsrfToken('');
          setAdminJwt('');
          window.location.href = '/?admin_session_expired=true';
        }
      }
      return response;
    } catch (err) {
      console.error('Admin API error:', err);
      throw err;
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
      setAdminCsrfToken,
      adminJwt,
      setAdminJwt,
      adminFetch,
      logout,
      showLoginModal,
      setShowLoginModal,
      openLoginModal,
      onLoginSuccess
    }}>
      {children}
    </UserContext.Provider>
  );
}
