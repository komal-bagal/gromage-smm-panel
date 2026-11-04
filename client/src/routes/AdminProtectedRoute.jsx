import { Navigate, Outlet } from "react-router-dom";

function AdminProtectedRoute() {
  const token =
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("admin_token")) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("admin_token"));

  // Protect admin routes: redirect unauthorized users to admin login
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}

export default AdminProtectedRoute;
