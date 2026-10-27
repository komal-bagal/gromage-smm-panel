import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaUsers,
  FaShoppingCart,
  FaMoneyBillWave,
  FaListUl,
  FaPlus,
  FaExternalLinkAlt,
  FaCheckCircle,
  FaSync,
  FaExclamationTriangle,
  FaArrowUp,
  FaServer,
  FaQrcode,
  FaWallet,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Loader";
import adminService from "../../../services/adminService";

function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("7days");

  /*
   * Fetch dashboard data from mock service layer.
   * Period filter dynamically updates chart dataset.
   */
  const loadDashboardData = useCallback(async (period = timeRange, isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!metrics) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await adminService.getDashboardMetrics(period);
      setMetrics(data);
    } catch (err) {
      console.error("Dashboard metrics load error:", err);
      setError("Unable to load dashboard metrics. Please check your connection and retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, metrics]);

  /*
   * Initial dashboard load.
   */
  useEffect(() => {
    let cancelled = false;

    const fetchInitialData = async () => {
      try {
        const data = await adminService.getDashboardMetrics("7days");
        if (!cancelled) {
          setMetrics(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Initial dashboard fetch error:", err);
          setError("Unable to load dashboard metrics. Please check your connection and retry.");
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Active chart dataset based on current period tab selection.
   */
  const currentChartData = useMemo(() => {
    if (!metrics) return [];
    if (metrics.revenueChartData && metrics.revenueChartData[timeRange]) {
      return metrics.revenueChartData[timeRange];
    }
    return metrics.revenueChart || [];
  }, [metrics, timeRange]);

  /*
   * Handle time range switch.
   */
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  /*
   * Handle manual refresh action.
   */
  const handleRefresh = () => {
    if (refreshing || loading) return;
    loadDashboardData(timeRange, true);
  };

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Operational overview, sales analytics, and fulfillment KPIs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            icon={<FaSync className={refreshing || loading ? "animate-spin text-blue-600" : ""} />}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Link to="/admin/services">
            <Button variant="primary" size="sm" icon={<FaPlus />}>
              Add Service
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <FaExclamationTriangle />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Failed to Load Dashboard Metrics</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => loadDashboardData(timeRange, true)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Initial Skeleton Loader */}
      {loading && !metrics ? (
        <div className="space-y-6">
          {/* KPI Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>

          {/* Quick Actions Skeleton */}
          <div className="bg-slate-900 rounded-xl p-5">
            <Skeleton className="h-5 w-48 mb-2 bg-slate-700" />
            <Skeleton className="h-4 w-72 mb-4 bg-slate-800" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-8 w-32 bg-slate-800" />
              ))}
            </div>
          </div>

          {/* Charts Row Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <Skeleton className="h-6 w-36 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-14 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
            {/* Total Revenue */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Revenue
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {metrics?.totalRevenue || "₹0"}
                  </h3>
                  {metrics?.revenueGrowth && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1 bg-emerald-50 px-2 py-0.5 rounded">
                      <FaArrowUp className="text-[9px]" />
                      {metrics.revenueGrowth}
                    </span>
                  )}
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                  <FaMoneyBillWave />
                </div>
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Orders
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {metrics?.totalOrders?.toLocaleString() || "0"}
                  </h3>
                  {metrics?.ordersGrowth && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded">
                      <FaArrowUp className="text-[9px]" />
                      {metrics.ordersGrowth}
                    </span>
                  )}
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center text-xl shrink-0">
                  <FaShoppingCart />
                </div>
              </div>
            </div>

            {/* Total Users */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Users
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {metrics?.totalUsers?.toLocaleString() || "0"}
                  </h3>
                  {metrics?.usersGrowth && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 mt-1 bg-indigo-50 px-2 py-0.5 rounded">
                      <FaArrowUp className="text-[9px]" />
                      {metrics.usersGrowth}
                    </span>
                  )}
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                  <FaUsers />
                </div>
              </div>
            </div>

            {/* Active Services */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Active Services
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {metrics?.activeServices || 0}
                    {metrics?.totalServices && (
                      <span className="text-xs font-normal text-gray-400 ml-1.5">
                        / {metrics.totalServices} total
                      </span>
                    )}
                  </h3>
                  <span className="inline-block text-[11px] font-medium text-amber-600 mt-1 bg-amber-50 px-2 py-0.5 rounded">
                    {metrics?.pendingOrders || 0} Pending Orders
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center text-xl shrink-0">
                  <FaListUl />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-xl p-4 sm:p-5 text-white mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                Quick Operations Center
              </h3>
              <p className="text-xs text-slate-300">
                Direct shortcuts to routine administrative and fulfillment tasks
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/admin/orders">
                <Button
                  size="xs"
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700"
                  icon={<FaShoppingCart className="text-xs" />}
                >
                  Orders ({metrics?.pendingOrders || 0} Pending)
                </Button>
              </Link>

              <Link to="/admin/providers">
                <Button
                  size="xs"
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700"
                  icon={<FaServer className="text-xs" />}
                >
                  Provider Balances
                </Button>
              </Link>

              <Link to="/admin/qr-payments">
                <Button
                  size="xs"
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700"
                  icon={<FaQrcode className="text-xs" />}
                >
                  QR Payment CMS
                </Button>
              </Link>

              <Link to="/admin/users">
                <Button
                  size="xs"
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700"
                  icon={<FaWallet className="text-xs" />}
                >
                  Adjust User Wallet
                </Button>
              </Link>
            </div>
          </div>

          {/* Charts & Balances Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Revenue Analytics Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Revenue & Sales Trend
                    </h3>
                    <p className="text-xs text-gray-500">
                      Sales volume analytics in INR (₹)
                    </p>
                  </div>

                  {/* Period Filter Buttons */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
                    {[
                      { key: "7days", label: "7 Days" },
                      { key: "30days", label: "30 Days" },
                      { key: "year", label: "This Year" },
                    ].map((period) => (
                      <button
                        key={period.key}
                        type="button"
                        onClick={() => handleTimeRangeChange(period.key)}
                        className={`px-3 py-1 rounded-md transition cursor-pointer ${
                          timeRange === period.key
                            ? "bg-white text-blue-600 shadow-xs font-bold"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts Area Container */}
                <div className="h-64 sm:h-72 w-full">
                  {currentChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      No revenue data available for this timeframe
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={(value) =>
                            value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`
                          }
                        />
                        <Tooltip
                          formatter={(value) => [
                            `₹${Number(value).toLocaleString("en-IN")}`,
                            "Revenue",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fill="url(#revenueGrad)"
                          activeDot={{ r: 6, fill: "#2563eb" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500 mt-2">
                <span>Displaying: <strong className="text-gray-800 capitalize">{timeRange === "year" ? "This Year" : timeRange === "30days" ? "Last 30 Days" : "Last 7 Days"}</strong></span>
                <span className="font-mono text-blue-600 font-semibold">
                  Peak: ₹{Math.max(...(currentChartData.map((d) => d.revenue || 0)), 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Provider Balances Widget */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Provider Balances
                    </h3>
                    <p className="text-xs text-gray-500">API provider funds & status</p>
                  </div>
                  <Link
                    to="/admin/providers"
                    className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Manage</span>
                    <FaExternalLinkAlt className="text-[9px]" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {!metrics?.providerBalances || metrics.providerBalances.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                      No providers configured
                    </div>
                  ) : (
                    metrics.providerBalances.map((provider, index) => (
                      <div
                        key={provider.id ?? provider.name ?? index}
                        className="p-3 rounded-lg border border-gray-100 bg-gray-50/70 hover:bg-gray-50 transition flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-semibold text-gray-800">
                            {provider.name}
                          </p>
                          <span
                            className={`text-[10px] font-medium ${
                              provider.status === "Active"
                                ? "text-emerald-600"
                                : "text-amber-600 font-bold"
                            }`}
                          >
                            ● {provider.status}
                          </span>
                          {provider.services && (
                            <span className="text-[10px] text-gray-400 ml-2">
                              ({provider.services} services)
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900 font-mono">
                            {provider.balance}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100">
                <Link to="/admin/providers" className="block w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    icon={<FaServer className="text-xs" />}
                  >
                    Check All Provider Balances
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Row: Recent Orders & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders Table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Recent Orders
                    </h3>
                    <p className="text-xs text-gray-500">
                      Live stream of customer placements
                    </p>
                  </div>

                  <Link
                    to="/admin/orders"
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View All Orders →
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[520px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                        <th className="py-2.5 px-4">Order ID</th>
                        <th className="py-2.5 px-4">User</th>
                        <th className="py-2.5 px-4">Service</th>
                        <th className="py-2.5 px-4">Amount</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {!metrics?.recentOrders || metrics.recentOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400 text-xs">
                            No recent customer orders found
                          </td>
                        </tr>
                      ) : (
                        metrics.recentOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="hover:bg-gray-50/80 transition"
                          >
                            <td className="py-3 px-4 font-mono font-semibold text-blue-600">
                              {order.id}
                            </td>

                            <td className="py-3 px-4 font-medium text-gray-900">
                              {order.user}
                            </td>

                            <td className="py-3 px-4 max-w-[200px] truncate text-gray-600" title={order.service}>
                              {order.service}
                            </td>

                            <td className="py-3 px-4 font-semibold text-gray-900 font-mono">
                              {order.amount || `₹${order.charge}`}
                            </td>

                            <td className="py-3 px-4">
                              <Badge status={order.status} size="xs" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
                <Link
                  to="/admin/orders"
                  className="text-xs text-gray-600 hover:text-blue-600 font-medium"
                >
                  Manage all orders in Order Management →
                </Link>
              </div>
            </div>

            {/* Recent Audit & System Activity Feed */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Recent System Activity
                    </h3>
                    <p className="text-xs text-gray-500">
                      Audit events & operations
                    </p>
                  </div>

                  <Link
                    to="/admin/audit-logs"
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Full Log
                  </Link>
                </div>

                <div className="space-y-4">
                  {!metrics?.recentActivity || metrics.recentActivity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No recent activity recorded
                    </div>
                  ) : (
                    metrics.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 text-xs"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                          <FaCheckCircle />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">
                            {activity.action}
                          </p>

                          <p className="text-gray-500 text-[11px] truncate" title={activity.detail || activity.description}>
                            {activity.detail || activity.description}
                          </p>

                          <span className="text-[10px] text-gray-400">
                            {activity.time || activity.createdAt}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100">
                <Link to="/admin/audit-logs" className="block w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                  >
                    View All Audit Logs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;