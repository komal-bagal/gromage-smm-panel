import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import "./Register.css";

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

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    whatsapp: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;

    setError("");
    setSuccess("");

    const username = formData.username?.trim();
    const email = formData.email?.trim().toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!username || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setIsAlreadyRegistered(false);

    try {
      const res = await api.post("/api/auth/register", {
        name: username,
        email,
        password,
      });

      const data = res.data;
      if (data?.success) {
        setSuccess(data?.message || "Registration successful! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } else {
        setError(data?.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      console.error("Registration Error:", err?.message || err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      const isRegistered =
        err?.status === 409 ||
        err?.response?.status === 409 ||
        err?.data?.isRegistered ||
        err?.response?.data?.isRegistered ||
        (backendMessage && /already registered|already exists/i.test(backendMessage));

      if (isRegistered) {
        setIsAlreadyRegistered(true);
      }

      let errorMsg;
      if (backendMessage && typeof backendMessage === "string" && backendMessage.trim()) {
        errorMsg = backendMessage.trim();
      } else if (err?.status === 409) {
        errorMsg = "Email already registered.";
      } else if (err?.status === 400) {
        errorMsg = "Invalid registration details. Please check your inputs.";
      } else if (err?.status >= 500) {
        errorMsg = "Server error during registration. Please try again later.";
      } else if (!err?.isBackendAvailable || (err?.message && (err.message.includes("Network Error") || err.message.includes("timeout")))) {
        errorMsg = "Unable to connect to server. Please check your connection or server status.";
      } else if (err?.message && typeof err.message === "string" && !err.message.includes("status code")) {
        errorMsg = err.message.trim();
      } else {
        errorMsg = "Registration failed. Please try again.";
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle || isLoading) return;
    setError("");
    setSuccess("");
    setIsAlreadyRegistered(false);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        "Google Sign-In is not configured yet. Please configure VITE_GOOGLE_CLIENT_ID in the client environment, or register using the form below."
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
            if (data?.success && data?.token) {
              login(data.token, data.user);
              setSuccess("Google sign-in successful! Redirecting to dashboard...");
              setTimeout(() => {
                navigate("/dashboard", { replace: true });
              }, 800);
            } else {
              setError(data?.message || "Google registration failed. Please try again.");
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

  return (
    <div className="register-container">
      <div className="register-box">

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoadingGoogle || isLoading}
          className="google-btn"
          style={{
            opacity: isLoadingGoogle ? 0.7 : 1,
            cursor: isLoadingGoogle ? "not-allowed" : "pointer"
          }}
        >
          {isLoadingGoogle ? "Connecting to Google..." : "🌈 Sign up with Google"}
        </button>

        {error && (
          <div
            style={{
              color: "#e11d48",
              backgroundColor: "#ffe4e6",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "14px",
              border: "1px solid #fecdd3",
              textAlign: "center"
            }}
          >
            <div>{error}</div>
            {isAlreadyRegistered && (
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", gap: "12px", fontSize: "12px" }}>
                <Link
                  to="/login"
                  style={{
                    color: "#1d4ed8",
                    fontWeight: "700",
                    textDecoration: "underline"
                  }}
                >
                  Sign In
                </Link>
                <span style={{ color: "#9ca3af" }}>•</span>
                <Link
                  to={`/forgot-password?email=${encodeURIComponent(formData.email.trim())}`}
                  style={{
                    color: "#1d4ed8",
                    fontWeight: "700",
                    textDecoration: "underline"
                  }}
                >
                  Forgot / Set Password
                </Link>
              </div>
            )}
          </div>
        )}

        {success && (
          <div
            style={{
              color: "#059669",
              backgroundColor: "#d1fae5",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "14px",
              border: "1px solid #a7f3d0",
              textAlign: "center"
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <label>Username</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            required
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />

          <label>WhatsApp</label>
          <input
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
            autoComplete="tel"
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />

          <label>Confirm password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />

          <button
            type="submit"
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? "not-allowed" : "pointer"
            }}
          >
            {isLoading ? "Signing up..." : "Sign up"}
          </button>

        </form>

        <p>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>

      </div>
    </div>
  );
}

export default Register;
