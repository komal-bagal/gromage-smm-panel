import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import api from "../../services/api";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [token, setToken] = useState(tokenParam);
  const [email, setEmail] = useState(emailParam);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;

    setError("");

    const cleanToken = token.trim();
    const cleanEmail = email.trim();

    if (!cleanToken || !cleanEmail) {
      setError("Reset token or email is missing. Please request a new password reset link.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post("/api/auth/reset-password", {
        token: cleanToken,
        email: cleanEmail,
        newPassword,
      });

      const data = res.data;
      if (data?.success) {
        setSuccess(true);
      } else {
        setError(data?.message || "Failed to reset password. The link may have expired.");
      }
    } catch (err) {
      console.error("Reset Password Error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      let errorMsg;
      if (backendMessage && typeof backendMessage === "string" && backendMessage.trim()) {
        errorMsg = backendMessage.trim();
      } else if (err?.status === 400) {
        errorMsg = "Invalid or expired reset token. Please request a new password reset link.";
      } else if (err?.status >= 500) {
        errorMsg = "Server error while resetting password. Please try again later.";
      } else if (!err?.isBackendAvailable || (err?.message && (err.message.includes("Network Error") || err.message.includes("timeout")))) {
        errorMsg = "Unable to connect to server. Please check your connection or server status.";
      } else if (err?.message && typeof err.message === "string" && !err.message.includes("status code")) {
        errorMsg = err.message.trim();
      } else {
        errorMsg = "Failed to reset password. Please try again.";
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
          <h2 className="text-lg font-bold text-gray-800 mt-4">Set New Password</h2>
          <p className="text-gray-500 text-xs mt-1">
            Choose a strong password for your account to sign in with email and password.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Password Configured!</h3>
              <p className="text-xs text-gray-500 mt-1">
                Your password has been successfully updated. You can now log in using your email and new password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition cursor-pointer shadow-sm text-sm"
            >
              Sign In Now →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* If email not prefilled or needs verification */}
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
              />
            </div>

            {/* Token field hidden or displayed if absent */}
            {!tokenParam && (
              <div>
                <label className="block text-gray-700 mb-1.5 font-medium text-sm">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-gray-700 mb-1.5 font-medium text-sm">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 chars)"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg pl-4 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition cursor-pointer focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-gray-700 mb-1.5 font-medium text-sm">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg pl-4 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition cursor-pointer focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm text-sm"
            >
              {isLoading ? "Updating Password..." : "Set Password and Continue"}
            </button>
          </form>
        )}

        {/* Links */}
        <div className="mt-6 text-center space-y-2 text-sm pt-4 border-t border-gray-100">
          <Link to="/login" className="block text-blue-600 hover:underline font-medium">
            ← Back to Sign In
          </Link>
          <Link to="/forgot-password" className="block text-gray-500 hover:text-gray-700 text-xs">
            Need a new reset link? Click here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
