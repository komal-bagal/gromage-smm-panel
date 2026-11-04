import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your account email address.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessData(null);

    try {
      const res = await api.post("/api/auth/forgot-password", {
        email: cleanEmail,
      });

      const data = res.data;
      if (data?.success) {
        setSuccessData(data);
      } else {
        setError(data?.message || "Failed to process password request. Please try again.");
      }
    } catch (err) {
      console.error("Forgot Password Error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      let errorMsg;
      if (backendMessage && typeof backendMessage === "string" && backendMessage.trim()) {
        errorMsg = backendMessage.trim();
      } else if (err?.status === 404) {
        errorMsg = "No account found with this email address. Please register or verify your email spelling.";
      } else if (err?.status >= 500) {
        errorMsg = "Server error while processing your request. Please try again later.";
      } else if (!err?.isBackendAvailable || (err?.message && (err.message.includes("Network Error") || err.message.includes("timeout")))) {
        errorMsg = "Unable to connect to server. Please check your connection or server status.";
      } else if (err?.message && typeof err.message === "string" && !err.message.includes("status code")) {
        errorMsg = err.message.trim();
      } else {
        errorMsg = "Failed to process password reset. Please try again.";
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Brand */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600">GROMAGE</h1>
          <p className="text-gray-500 text-sm mt-1">Social Media Marketing Panel</p>
          <h2 className="text-lg font-bold text-gray-800 mt-4">
            Reset or Set Account Password
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Enter your email address. If you registered via Google Sign-In or forgot your password, you can configure a password below.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {successData && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-3">
            <p className="font-semibold text-emerald-900">
              {successData.message || "Password link generated successfully!"}
            </p>
            {successData.resetUrl && (
              <div className="pt-2 border-t border-emerald-200">
                <p className="text-[11px] text-emerald-700 mb-2">
                  Click the button below to proceed to the secure password configuration page:
                </p>
                <Link
                  to={`/reset-password?token=${successData.resetToken}&email=${encodeURIComponent(successData.email)}`}
                  className="inline-block w-full text-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-sm"
                >
                  Configure My Password →
                </Link>
              </div>
            )}
          </div>
        )}

        {!successData && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1.5 font-medium text-sm">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? "Generating Link..." : "Send Password Reset Link"}
            </button>
          </form>
        )}

        {/* Links */}
        <div className="mt-6 text-center space-y-2 text-sm pt-4 border-t border-gray-100">
          <Link to="/login" className="block text-blue-600 hover:underline font-medium">
            ← Back to Sign In
          </Link>
          <Link to="/register" className="block text-gray-600 hover:text-blue-600">
            Don't have an account? Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
