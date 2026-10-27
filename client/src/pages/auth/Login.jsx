import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      const data = res.data;
      const token = data?.token || data?.jwt || data?.accessToken;
      const user = data?.user || data?.data?.user;

      if (token) {
        localStorage.setItem("token", token);
        if (user?.role === "admin" || user?.role === "Admin") {
          localStorage.setItem("admin_token", token);
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        setError(data?.message || "Invalid email or password");
      }
    } catch (err) {
      console.error("Login Error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      let errorMsg;
      if (backendMessage && typeof backendMessage === "string" && backendMessage.trim()) {
        errorMsg = backendMessage.trim();
      } else if (err?.message && typeof err.message === "string" && !err.message.includes("status code") && !err.message.startsWith("Network Error") && !err.message.startsWith("timeout")) {
        errorMsg = err.message.trim();
      } else if (err?.status === 401 || err?.status === 400 || err?.status === 403) {
        errorMsg = "Invalid email or password";
      } else if (!err?.isBackendAvailable) {
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 sm:p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">
            GROMAGE
          </h1>
          <p className="text-gray-500 text-sm">
            Social Media Marketing Panel
          </p>
        </div>

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
            <label className="block text-gray-700 mb-2 font-medium text-sm">
              Password
            </label>

            <input
              id="customer-password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
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
            to="/forgot-password"
            className="block text-blue-600 hover:underline"
          >
            Forgot Password?
          </Link>

          <Link
            to="/register"
            className="block text-gray-600 hover:text-blue-600"
          >
            Create Account
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