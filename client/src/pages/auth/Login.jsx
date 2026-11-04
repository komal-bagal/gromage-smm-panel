import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const loadGoogleScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
      return resolve(window.google);
    }
    const existing = document.getElementById("google-gsi-client");
    if (existing) {
      if (window.google?.accounts?.oauth2) return resolve(window.google);
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
};

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [googlePromptInfo, setGooglePromptInfo] = useState(null);

  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle || isLoading) return;
    setError("");
    setGooglePromptInfo(null);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        "Google Sign-In is not configured yet. Please configure VITE_GOOGLE_CLIENT_ID in the client environment, or sign in using email and password."
      );
      return;
    }

    setIsLoadingGoogle(true);

    try {
      const google = await loadGoogleScript();
      if (!google?.accounts?.oauth2) {
        throw new Error(
          "Unable to load Google Sign-In SDK. Please check your network connection or ad blocker."
        );
      }

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            console.error("Google Auth Token Error:", tokenResponse.error);
            setError(`Google authentication failed: ${tokenResponse.error}`);
            setIsLoadingGoogle(false);
            return;
          }

          if (!tokenResponse?.access_token) {
            setError("No access token received from Google. Please try again.");
            setIsLoadingGoogle(false);
            return;
          }

          try {
            const res = await api.post("/api/auth/google", {
              accessToken: tokenResponse.access_token,
            });

            const data = res.data;
            const token = data?.token || data?.jwt || data?.accessToken;
            const user = data?.user || data?.data?.user;

            if (data?.success && token) {
              login(token, user);

              if (user?.role === "admin" || user?.role === "Admin") {
                sessionStorage.setItem("admin_token", token);
                localStorage.setItem("admin_token", token);
                navigate("/admin/dashboard", { replace: true });
              } else {
                sessionStorage.removeItem("admin_token");
                localStorage.removeItem("admin_token");
                navigate("/dashboard", { replace: true });
              }
            } else {
              setError(data?.message || "Google sign-in failed. Please try again.");
            }
          } catch (apiErr) {
            console.error("Google Server Auth Error:", apiErr);
            const backendMessage =
              apiErr?.data?.message ||
              apiErr?.response?.data?.message ||
              apiErr?.data?.error ||
              apiErr?.response?.data?.error;

            let safeMessage;
            if (backendMessage && typeof backendMessage === "string" && backendMessage.trim()) {
              safeMessage = backendMessage.trim();
            } else if (!apiErr?.isBackendAvailable || apiErr?.message?.includes("Network Error")) {
              safeMessage = "Unable to connect to the authentication server. Please check your network connection or server status.";
            } else if (apiErr?.status === 401 || apiErr?.status === 403) {
              safeMessage = apiErr?.message || "Google authentication was rejected by the server.";
            } else if (apiErr?.status >= 500) {
              safeMessage = "Internal server error during Google authentication. Please try again.";
            } else if (apiErr?.message && typeof apiErr.message === "string" && !apiErr.message.includes("status code")) {
              safeMessage = apiErr.message.trim();
            } else {
              safeMessage = "Failed to authenticate Google user on server.";
            }
            setError(safeMessage);
          } finally {
            setIsLoadingGoogle(false);
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      setError(err?.message || "Failed to initialize Google Sign-In.");
      setIsLoadingGoogle(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setError("");
    setGooglePromptInfo(null);

    try {
      const res = await api.post("/api/auth/login", {
        email: cleanEmail,
        password,
      });

      const data = res.data;
      const token = data?.token || data?.jwt || data?.accessToken;
      const user = data?.user || data?.data?.user;

      if (token) {
        login(token, user);

        if (user?.role === "admin" || user?.role === "Admin") {
          sessionStorage.setItem("admin_token", token);
          localStorage.setItem("admin_token", token);
          navigate("/admin/dashboard", { replace: true });
        } else {
          sessionStorage.removeItem("admin_token");
          localStorage.removeItem("admin_token");
          navigate("/dashboard", { replace: true });
        }
      } else {
        setError(data?.message || "Invalid email or password");
      }
    } catch (err) {
      console.error("Login Error:", err);
      const resData = err?.data || err?.response?.data;
      const backendMessage =
        resData?.message ||
        resData?.error ||
        err?.message;

      // Check if this account was created via Google Sign-In and lacks a password
      if (resData?.hasPassword === false || (backendMessage && /Google Sign-In/i.test(backendMessage))) {
        setGooglePromptInfo({
          email: cleanEmail,
          message: backendMessage || "This account was created with Google Sign-In and does not have a password configured yet."
        });
        setError("");
        return;
      }

      let errorMsg;
      if (backendMessage && typeof backendMessage === "string" && backendMessage.trim() && !backendMessage.includes("status code")) {
        errorMsg = backendMessage.trim();
      } else if (err?.status === 401 || err?.status === 400 || err?.status === 403) {
        errorMsg = "Invalid email or password";
      } else if (err?.status >= 500) {
        errorMsg = "Server error during login. Please try again later.";
      } else if (!err?.isBackendAvailable || (err?.message && (err.message.includes("Network Error") || err.message.includes("timeout")))) {
        errorMsg = "Unable to connect to server. Please check your connection or server status.";
      } else {
        errorMsg = "Invalid email or password";
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 sm:p-8">

        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600">
            GROMAGE
          </h1>
          <p className="text-gray-500 text-sm">
            Social Media Marketing Panel
          </p>
        </div>

        {/* Google Sign In Option */}
        <div className="mb-5">
          <button
            type="button"
            id="google-login-button"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-medium text-sm transition shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isLoadingGoogle ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400 font-medium">Or continue with email</span>
            </div>
          </div>
        </div>

        {/* Specialized Google account prompt when password is not set */}
        {googlePromptInfo && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
            <p className="font-semibold text-amber-950">
              {googlePromptInfo.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer text-center shadow-sm"
              >
                Sign In with Google
              </button>
              <Link
                to={`/forgot-password?email=${encodeURIComponent(googlePromptInfo.email)}`}
                className="flex-1 py-2 px-3 bg-white hover:bg-gray-50 text-amber-900 border border-amber-300 rounded-lg font-semibold text-xs transition text-center shadow-sm"
              >
                Set Password Now
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form id="customer-login-form" onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium text-sm">
              Email
            </label>

            <input
              id="customer-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-700 font-medium text-sm">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            <div className="relative">
              <input
                id="customer-password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg pl-4 pr-11 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                id="customer-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition cursor-pointer focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <FaEyeSlash className="w-4 h-4" />
                ) : (
                  <FaEye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            id="customer-login-button"
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>

        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-2 text-sm">

          <Link
            to="/register"
            className="block text-gray-600 hover:text-blue-600"
          >
            Don't have an account? <span className="text-blue-600 font-medium">Create Account</span>
          </Link>

          <div className="pt-3 border-t border-gray-100">
            <Link
              to="/admin/login"
              className="inline-block text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
            >
              Sign In to Admin CMS Portal →
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Login;
