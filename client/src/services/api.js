import axios from "axios";

const RAW_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = RAW_API_URL.replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("admin_token") || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Unified Error Handling (401, 403, 404, 422, 429, 5xx)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const backendMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      (typeof error.response?.data === "string" && !error.response.data.startsWith("<")
        ? error.response.data
        : null);

    const message =
      backendMessage ||
      (status === 401 ? "Invalid email or password" : error.message) ||
      "An unexpected error occurred.";

    if (status === 401) {
      // Unauthorized: session token expired or invalid
      console.warn("Unauthorized API access (401):", error.config?.url);
    } else if (status === 403) {
      // Forbidden: access denied due to role permissions
      console.warn("Forbidden API access (403):", error.config?.url);
    } else if (status === 404) {
      // Not Found: resource or endpoint missing
      console.info("Endpoint or resource not found (404):", error.config?.url);
    } else if (status === 422) {
      // Unprocessable Entity: form / payload validation failed
      console.warn("Payload validation error (422):", error.response?.data);
    } else if (status === 429) {
      // Rate Limit Exceeded: too many requests
      console.warn("Rate limit threshold exceeded (429):", error.config?.url);
    } else if (status >= 500) {
      // Internal Server / Gateway Errors
      console.error(`Upstream Server Error (${status}):`, message);
    }

    return Promise.reject({
      status,
      message,
      data: error.response?.data,
      isBackendAvailable: !!error.response,
      response: error.response,
    });
  }
);

export default api;
