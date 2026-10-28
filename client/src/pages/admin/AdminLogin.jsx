import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUserShield, FaLock, FaEnvelope, FaArrowRight } from "react-icons/fa";
import Button from "../../components/ui/Button";
import adminService from "../../services/adminService";

function AdminLogin() {
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
      const res = await adminService.login({
        email: email.trim(),
        password,
      });

      if (res && (res.token || res.jwt || res.accessToken)) {
        navigate("/admin/dashboard", { replace: true });
      } else {
        setError(res?.message || "Invalid email or password");
      }
    } catch (err) {
      console.error("Admin Login Error:", err);

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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <FaUserShield />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            GROMAGE <span className="text-blue-500">ADMIN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Commercial SMM Reseller CMS Portal
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                <FaEnvelope />
              </div>
              <input
                id="admin-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-600"
                placeholder="admin@gromage.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                <FaLock />
              </div>
              <input
                id="admin-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-600"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              id="admin-login-button"
              type="submit"
              form="admin-login-form"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 font-semibold text-white py-3 rounded-xl shadow-lg shadow-blue-600/25 cursor-pointer"
            >
              <span>Sign In to Admin CMS</span>
              <FaArrowRight className="ml-1 text-xs" />
            </Button>
          </div>
        </form>

        {/* Demo Hint */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Developer / Evaluator Mode:{" "}
            <button
              type="button"
              onClick={() => {
                setEmail("admin@gromage.com");
                setPassword("admin123");
              }}
              className="text-blue-400 hover:underline font-mono cursor-pointer ml-1"
            >
              admin@gromage.com / admin123
            </button>
          </p>
          <div className="mt-3">
            <Link
              to="/login"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              ← Go back to Customer Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
