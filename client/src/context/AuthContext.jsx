/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const AuthContext = createContext();

const getInitialAuth = () => {
  try {
    // 1. Per-tab session storage has highest priority for tab isolation
    const sessionToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("token") : null;
    const sessionUserStr = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("user") : null;

    if (sessionToken) {
      let parsedUser = null;
      try {
        parsedUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;
      } catch {
        parsedUser = null;
      }
      return { token: sessionToken, user: parsedUser };
    }

    // 2. If new tab with empty sessionStorage, inherit from localStorage
    const localToken = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    const localUserStr = typeof localStorage !== "undefined" ? localStorage.getItem("user") : null;

    if (localToken) {
      let parsedUser = null;
      try {
        parsedUser = localUserStr ? JSON.parse(localUserStr) : null;
      } catch {
        parsedUser = null;
      }

      // Isolate to this tab's sessionStorage
      try {
        sessionStorage.setItem("token", localToken);
        if (localUserStr) {
          sessionStorage.setItem("user", localUserStr);
        }
      } catch {
        // ignore storage quota errors
      }

      return { token: localToken, user: parsedUser };
    }
  } catch (err) {
    console.error("Error reading initial auth storage:", err);
  }

  return { token: null, user: null };
};

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(getInitialAuth);

  const token = authState.token;
  const user = authState.user;

  const login = useCallback((newToken, newUser = null) => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("token", newToken);
        if (newUser) {
          sessionStorage.setItem("user", JSON.stringify(newUser));
        }
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("token", newToken);
        if (newUser) {
          localStorage.setItem("user", JSON.stringify(newUser));
        }
      }
    } catch (e) {
      console.warn("Storage write error during login:", e);
    }

    setAuthState({
      token: newToken,
      user: newUser,
    });
  }, []);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    try {
      const userStr = JSON.stringify(updatedUser);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("user", userStr);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("user", userStr);
      }
    } catch (e) {
      console.warn("Storage write error during updateUser:", e);
    }

    setAuthState((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  }, []);

  const logout = useCallback(() => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("admin_token");
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("user");
      }
    } catch (e) {
      console.warn("Storage remove error during logout:", e);
    }

    setAuthState({
      token: null,
      user: null,
    });
  }, []);

  // Cross-tab storage coordination:
  // If an explicit global logout happened, clear session consistently.
  // Never silently overwrite this tab's authenticated user with another tab's login.
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "token" && !e.newValue) {
        // Global logout triggered from another tab
        // If current tab is not independently authenticated, sync logout
        const currentSessionToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("token") : null;
        if (!currentSessionToken) {
          setAuthState({ token: null, user: null });
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
