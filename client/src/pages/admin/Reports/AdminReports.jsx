/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FaFileExport,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
  FaSync,
  FaServer,
  FaChartBar,
  FaChartLine,
  FaMoneyBillWave,
  FaShoppingBag,
  FaPercentage,
  FaExclamationTriangle,
  FaCheckCircle,
  FaArrowUp,
  FaArrowDown,
  FaTable,
  FaLayerGroup,
  FaInstagram,
  FaYoutube,
  FaTelegram,
  FaFacebook,
  FaTwitter,
  FaCalendarAlt,
  FaRedo,
  FaWallet,
  FaReceipt,
  FaUsers,
  FaCrown,
  FaStar,
  FaBoxes,
  FaQrcode,
  FaCreditCard,
  FaUniversity,
  FaShieldAlt,
  FaChevronDown,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

// Helper: Format numeric amounts to INR Currency with optional decimals
function formatINR(val, fractionDigits = 2) {
  if (val === null || val === undefined || isNaN(val)) {
    return "₹0.00";
  }
  const num = Number(val);
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

// Helper: Compact currency for chart ticks
function formatCompactINR(val) {
  if (val === null || val === undefined || isNaN(val)) return "₹0";
  const num = Number(val);
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(1)}Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)}L`;
  }
  if (num >= 1000) {
    return `₹${(num / 1000).toFixed(0)}k`;
  }
  return `₹${num}`;
}

// Helper: Format integer numbers
function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return "0";
  return Number(val).toLocaleString("en-IN");
}

// Helper: Get brand icon & colors for social platform categories
function getPlatformIcon(category = "") {
  const cat = category.toLowerCase();
  if (cat.includes("instagram")) {
    return {
      icon: <FaInstagram className="text-pink-600" />,
      bg: "bg-pink-50 text-pink-700 border-pink-200",
    };
  }
  if (cat.includes("youtube")) {
    return {
      icon: <FaYoutube className="text-red-600" />,
      bg: "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (cat.includes("telegram")) {
    return {
      icon: <FaTelegram className="text-sky-500" />,
      bg: "bg-sky-50 text-sky-700 border-sky-200",
    };
  }
  if (cat.includes("facebook")) {
    return {
      icon: <FaFacebook className="text-blue-600" />,
      bg: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (cat.includes("twitter") || cat.includes("x")) {
    return {
      icon: <FaTwitter className="text-slate-800" />,
      bg: "bg-slate-100 text-slate-800 border-slate-200",
    };
  }
  return {
    icon: <FaLayerGroup className="text-indigo-600" />,
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
}

// Helper: Get payment method icon & styling
function getPaymentMethodIcon(method = "") {
  const m = method.toLowerCase();
  if (m.includes("upi") || m.includes("qr") || m.includes("paytm") || m.includes("phonepe")) {
    return {
      icon: <FaQrcode className="text-emerald-600" />,
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (m.includes("razorpay") || m.includes("card")) {
    return {
      icon: <FaCreditCard className="text-blue-600" />,
      bg: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (m.includes("bank") || m.includes("neft") || m.includes("imps") || m.includes("transfer")) {
    return {
      icon: <FaUniversity className="text-purple-600" />,
      bg: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }
  return {
    icon: <FaWallet className="text-amber-600" />,
    bg: "bg-amber-50 text-amber-700 border-amber-200",
  };
}

// Custom Tooltip for Recharts
function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const revenue = dataPoint?.revenue || 0;
  const profit = dataPoint?.profit || 0;
  const orders = dataPoint?.orders || 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-gray-900 text-white p-3.5 rounded-xl shadow-xl border border-gray-800 text-xs min-w-[200px]">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2 font-bold text-gray-200">
        <FaChartBar className="text-blue-400" />
        <span>{label} Platform</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Gross Revenue:
          </span>
          <span className="font-mono font-semibold text-white">
            {formatINR(revenue, 2)}
          </span>
        </div>
        <div className="flex justify-between items-center text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Net Profit:
          </span>
          <span className="font-mono font-semibold text-emerald-400">
            {formatINR(profit, 2)}
          </span>
        </div>
        <div className="flex justify-between items-center text-gray-400 pt-1 border-t border-gray-800/80">
          <span>Profit Margin:</span>
          <span className="font-semibold text-emerald-300">{margin}%</span>
        </div>
        <div className="flex justify-between items-center text-gray-400">
          <span>Orders Delivered:</span>
          <span className="font-mono text-gray-200">{formatNumber(orders)}</span>
        </div>
      </div>
    </div>
  );
}

function AdminReports() {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("monthly");
  const [exportOpen, setExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target)
      ) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch report handler
  const fetchReport = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (!data) {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await adminService.getReports("sales", range);
        if (!res) {
          throw new Error("No data received from report service");
        }
        setData(res);
        if (isManualRefresh) {
          addToast(
            `Analytics refreshed for ${range.toUpperCase()} range`,
            "success"
          );
        }
      } catch (err) {
        const errMsg =
          err?.message || "Failed to load financial & performance report";
        setError(errMsg);
        addToast(errMsg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, data, addToast]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Derived calculations from active report data
  const salesBreakdown = useMemo(() => {
    return Array.isArray(data?.salesBreakdown) ? data.salesBreakdown : [];
  }, [data]);

  const providerPerformance = useMemo(() => {
    return Array.isArray(data?.providerPerformance)
      ? data.providerPerformance
      : [];
  }, [data]);

  const walletSummary = useMemo(() => {
    return (
      data?.walletSummary || {
        totalDeposits: 0,
        totalSpent: 0,
        netInflow: 0,
        totalPlatformBalance: 0,
        rechargeCount: 0,
        methodBreakdown: [],
      }
    );
  }, [data]);

  const gstSummary = useMemo(() => {
    return (
      data?.gstSummary || {
        taxableTurnover: 0,
        totalTax: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        gstRate: "18% (SAC 998314 - IT & Internet Services)",
        invoicesCount: 0,
        stateBreakdown: [],
      }
    );
  }, [data]);

  const topUsers = useMemo(() => {
    return Array.isArray(data?.topUsers) ? data.topUsers : [];
  }, [data]);

  const topServices = useMemo(() => {
    return Array.isArray(data?.topServices) ? data.topServices : [];
  }, [data]);

  // Dynamic Totals calculation
  const totals = useMemo(() => {
    const totalSales =
      data?.totalSales !== undefined
        ? Number(data.totalSales)
        : salesBreakdown.reduce((acc, curr) => acc + (Number(curr.revenue) || 0), 0);

    const totalProfit =
      data?.totalProfit !== undefined
        ? Number(data.totalProfit)
        : salesBreakdown.reduce((acc, curr) => acc + (Number(curr.profit) || 0), 0);

    const ordersCompleted =
      data?.ordersCompleted !== undefined
        ? Number(data.ordersCompleted)
        : salesBreakdown.reduce((acc, curr) => acc + (Number(curr.orders) || 0), 0);

    const avgOrderValue =
      data?.avgOrderValue !== undefined
        ? Number(data.avgOrderValue)
        : ordersCompleted > 0
        ? totalSales / ordersCompleted
        : 0;

    const profitMargin =
      totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : "0.0";

    const totalProviderOrders = providerPerformance.reduce(
      (acc, curr) => acc + (Number(curr.ordersSent) || 0),
      0
    );

    return {
      totalSales,
      totalProfit,
      ordersCompleted,
      avgOrderValue,
      profitMargin,
      totalProviderOrders,
    };
  }, [data, salesBreakdown, providerPerformance]);

  // Comparative growth metrics vs previous period (if provided)
  const growthMetrics = useMemo(() => {
    const prev = data?.previousPeriod;
    if (!prev) return null;

    const salesGrowth =
      prev.sales > 0
        ? (((totals.totalSales - prev.sales) / prev.sales) * 100).toFixed(1)
        : null;

    const profitGrowth =
      prev.profit > 0
        ? (((totals.totalProfit - prev.profit) / prev.profit) * 100).toFixed(1)
        : null;

    const ordersGrowth =
      prev.orders > 0
        ? (
            ((totals.ordersCompleted - prev.orders) / prev.orders) *
            100
          ).toFixed(1)
        : null;

    const aovGrowth =
      prev.avgOrderValue > 0
        ? (
            ((totals.avgOrderValue - prev.avgOrderValue) / prev.avgOrderValue) *
            100
          ).toFixed(1)
        : null;

    return {
      salesGrowth,
      profitGrowth,
      ordersGrowth,
      aovGrowth,
    };
  }, [data, totals]);

  // -------------------------------------------------------------
  // EXPORT HANDLERS (CSV, EXCEL, PDF)
  // -------------------------------------------------------------

  // 1. Multi-Section CSV Export
  const handleExportCsv = () => {
    if (!data) {
      addToast("No report data available to export for this period", "error");
      return;
    }

    try {
      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
      const periodLabel = data?.periodLabel || range.toUpperCase();

      let csvContent = "";

      // Document Header
      csvContent += `"GROMAGE SMM PANEL - FINANCIAL & OPERATIONAL ANALYTICS REPORT"\n`;
      csvContent += `"Report Range:","${range.toUpperCase()}"\n`;
      csvContent += `"Period Covered:","${periodLabel}"\n`;
      csvContent += `"Generated At:","${nowStr} IST"\n`;
      csvContent += `\n`;

      // Section 1: KPI Summary
      csvContent += `"=== SECTION 1: KEY PERFORMANCE INDICATORS ==="\n`;
      csvContent += `"Metric","Value (INR / Count)","Performance Note"\n`;
      csvContent += `"Gross Sales",${totals.totalSales},"${
        growthMetrics?.salesGrowth
          ? `${Number(growthMetrics.salesGrowth) >= 0 ? "+" : ""}${growthMetrics.salesGrowth}% vs previous period`
          : "Current selected period"
      }"\n`;
      csvContent += `"Net Profit",${totals.totalProfit},"${totals.profitMargin}% Net Margin"\n`;
      csvContent += `"Average Order Value",${totals.avgOrderValue.toFixed(2)},"Per completed order"\n`;
      csvContent += `"Orders Delivered",${totals.ordersCompleted},"${
        growthMetrics?.ordersGrowth
          ? `${Number(growthMetrics.ordersGrowth) >= 0 ? "+" : ""}${growthMetrics.ordersGrowth}% volume growth`
          : "Completed in period"
      }"\n`;
      csvContent += `\n`;

      // Section 2: Platform Sales Breakdown
      if (salesBreakdown.length > 0) {
        csvContent += `"=== SECTION 2: SALES BREAKDOWN BY SOCIAL PLATFORM ==="\n`;
        csvContent += `"Platform Category","Gross Revenue (INR)","Revenue Share (%)","Net Profit (INR)","Profit Margin (%)","Orders Count","Avg Value / Order (INR)"\n`;

        salesBreakdown.forEach((r) => {
          const rev = Number(r.revenue) || 0;
          const prof = Number(r.profit) || 0;
          const ord = Number(r.orders) || 0;
          const share =
            totals.totalSales > 0
              ? ((rev / totals.totalSales) * 100).toFixed(1)
              : "0.0";
          const margin = rev > 0 ? ((prof / rev) * 100).toFixed(1) : "0.0";
          const aov = ord > 0 ? (rev / ord).toFixed(2) : "0.00";

          csvContent += `"${r.category}",${rev},"${share}%",${prof},"${margin}%",${ord},${aov}\n`;
        });

        csvContent += `"TOTAL",${totals.totalSales},"100.0%",${totals.totalProfit},"${totals.profitMargin}%",${totals.ordersCompleted},${totals.avgOrderValue.toFixed(2)}\n`;
        csvContent += `\n`;
      }

      // Section 3: Wallet Analytics & Payment Gateway Inflow
      if (walletSummary) {
        csvContent += `"=== SECTION 3: WALLET ANALYTICS & PAYMENT GATEWAYS ==="\n`;
        csvContent += `"Total Deposits (INR)",${walletSummary.totalDeposits || 0}\n`;
        csvContent += `"Total Spent from Wallets (INR)",${walletSummary.totalSpent || 0}\n`;
        csvContent += `"Net Platform Inflow (INR)",${walletSummary.netInflow || 0}\n`;
        csvContent += `"Platform Balance Liability (INR)",${walletSummary.totalPlatformBalance || 0}\n`;
        csvContent += `"Recharge / Deposit Count",${walletSummary.rechargeCount || 0}\n`;
        csvContent += `\n`;

        if (Array.isArray(walletSummary.methodBreakdown) && walletSummary.methodBreakdown.length > 0) {
          csvContent += `"Payment Gateway / Method","Recharge Count","Gross Volume (INR)","Gateway Fee (INR)","Net Settled (INR)","Volume Share (%)"\n`;
          walletSummary.methodBreakdown.forEach((m) => {
            csvContent += `"${m.method}",${m.count},${m.amount},${m.fee || 0},${m.netAmount || m.amount},"${m.share || "0.0%"}"\n`;
          });
          csvContent += `\n`;
        }
      }

      // Section 4: Tax / GST Compliance Report
      if (gstSummary) {
        csvContent += `"=== SECTION 4: TAX & GST COMPLIANCE SUMMARY ==="\n`;
        csvContent += `"Tax Classification","${gstSummary.gstRate || "18% GST (SAC 998314)"}"\n`;
        csvContent += `"Taxable Turnover (INR)",${gstSummary.taxableTurnover || 0}\n`;
        csvContent += `"Total GST Collected (INR)",${gstSummary.totalTax || 0}\n`;
        csvContent += `"CGST (Intra-State 9%) (INR)",${gstSummary.cgst || 0}\n`;
        csvContent += `"SGST (Intra-State 9%) (INR)",${gstSummary.sgst || 0}\n`;
        csvContent += `"IGST (Inter-State 18%) (INR)",${gstSummary.igst || 0}\n`;
        csvContent += `"Invoices Count",${gstSummary.invoicesCount || 0}\n`;
        csvContent += `\n`;

        if (Array.isArray(gstSummary.stateBreakdown) && gstSummary.stateBreakdown.length > 0) {
          csvContent += `"State / Territory","Invoices","Taxable Amount (INR)","CGST (INR)","SGST (INR)","IGST (INR)","Total Tax (INR)"\n`;
          gstSummary.stateBreakdown.forEach((s) => {
            csvContent += `"${s.state}",${s.invoices},${s.taxable},${s.cgst},${s.sgst},${s.igst},${s.totalTax}\n`;
          });
          csvContent += `\n`;
        }
      }

      // Section 5: Top Spending Users
      if (topUsers.length > 0) {
        csvContent += `"=== SECTION 5: TOP SPENDING & ACTIVE USERS ==="\n`;
        csvContent += `"Rank","User ID","Full Name","Email Address","Account Role","Orders Placed","Total Spent (INR)","Wallet Balance (INR)","Account Status"\n`;
        topUsers.forEach((u) => {
          csvContent += `"#${u.rank}","${u.id}","${u.name}","${u.email}","${u.role}",${u.ordersCount},${u.spent},${u.balance},"${u.status}"\n`;
        });
        csvContent += `\n`;
      }

      // Section 6: Top Performing Services
      if (topServices.length > 0) {
        csvContent += `"=== SECTION 6: TOP PERFORMING SERVICES ==="\n`;
        csvContent += `"Rank","Service ID","Service Name","Platform Category","Provider Node","Orders Delivered","Gross Revenue (INR)","Net Profit (INR)","Profit Margin (%)"\n`;
        topServices.forEach((s) => {
          csvContent += `"#${s.rank}","${s.id}","${s.name}","${s.category}","${s.provider}",${s.ordersCount},${s.revenue},${s.profit},"${s.margin}"\n`;
        });
        csvContent += `\n`;
      }

      // Section 7: Provider Performance
      if (providerPerformance.length > 0) {
        csvContent += `"=== SECTION 7: PROVIDER FULFILLMENT & API PERFORMANCE ==="\n`;
        csvContent += `"Provider Name","Orders Routed","Volume Share (%)","Success Rate","Avg Fulfillment Latency","Health Status"\n`;

        providerPerformance.forEach((p) => {
          const sent = Number(p.ordersSent) || 0;
          const share =
            totals.totalProviderOrders > 0
              ? ((sent / totals.totalProviderOrders) * 100).toFixed(1)
              : "0.0";
          const health = p.health || (parseFloat(p.successRate) >= 98 ? "Optimal" : "Good");

          csvContent += `"${p.name}",${sent},"${share}%","${p.successRate}","${p.avgTime}","${health}"\n`;
        });
      }

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `gromage-financial-report-${range}-${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      setExportOpen(false);
      addToast(
        `Financial report (${range.toUpperCase()}) exported as CSV`,
        "success"
      );
    } catch {
      addToast("Failed to generate CSV export file", "error");
    }
  };

  // 2. Excel XML/HTML Spreadsheet Export
  const handleExportExcel = () => {
    if (!data) {
      addToast("No report data available to export for this period", "error");
      return;
    }

    try {
      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
      const periodLabel = data?.periodLabel || range.toUpperCase();

      const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Financial Analytics</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px 12px; border: 1px solid #e2e8f0; }
          .header-title { font-size: 16pt; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; }
          .sub-title { font-size: 10pt; color: #64748b; margin-bottom: 15px; }
          .section-title { font-size: 12pt; font-weight: bold; color: #0f172a; margin-top: 15px; margin-bottom: 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
          .num { text-align: right; }
          .bold { font-weight: bold; }
          .total-row { background-color: #f1f5f9; font-weight: bold; }
          .green { color: #059669; }
          .blue { color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="header-title">GROMAGE SMM PANEL - FINANCIAL & OPERATIONAL ANALYTICS</div>
        <div class="sub-title">Report Range: <b>${range.toUpperCase()}</b> | Period: <b>${periodLabel}</b> | Generated: ${nowStr} IST</div>

        <div class="section-title">1. Key Performance Indicators</div>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="num">Value (INR / Units)</th>
              <th>Performance Note</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Gross Sales</td><td class="num bold">${formatINR(totals.totalSales, 2)}</td><td>Delivered volume revenue</td></tr>
            <tr><td>Net Profit</td><td class="num bold green">${formatINR(totals.totalProfit, 2)}</td><td>${totals.profitMargin}% Net Margin</td></tr>
            <tr><td>Average Order Value</td><td class="num">${formatINR(totals.avgOrderValue, 2)}</td><td>Per completed transaction</td></tr>
            <tr><td>Orders Delivered</td><td class="num">${formatNumber(totals.ordersCompleted)}</td><td>Automated API routing</td></tr>
          </tbody>
        </table>

        <div class="section-title">2. Social Platform Sales Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Platform Category</th>
              <th class="num">Gross Revenue (INR)</th>
              <th class="num">Revenue Share</th>
              <th class="num">Net Profit (INR)</th>
              <th class="num">Margin (%)</th>
              <th class="num">Orders Count</th>
            </tr>
          </thead>
          <tbody>
            ${salesBreakdown
              .map(
                (item) => `
              <tr>
                <td class="bold">${item.category}</td>
                <td class="num">${formatINR(item.revenue, 2)}</td>
                <td class="num">${totals.totalSales > 0 ? ((item.revenue / totals.totalSales) * 100).toFixed(1) : 0}%</td>
                <td class="num green">${formatINR(item.profit, 2)}</td>
                <td class="num">${item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : 0}%</td>
                <td class="num">${formatNumber(item.orders)}</td>
              </tr>
            `
              )
              .join("")}
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="num">${formatINR(totals.totalSales, 2)}</td>
              <td class="num">100.0%</td>
              <td class="num green">${formatINR(totals.totalProfit, 2)}</td>
              <td class="num">${totals.profitMargin}%</td>
              <td class="num">${formatNumber(totals.ordersCompleted)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">3. Wallet Analytics & Payment Gateways</div>
        <table>
          <thead>
            <tr>
              <th>Payment Gateway / Method</th>
              <th class="num">Recharge Count</th>
              <th class="num">Gross Inflow (INR)</th>
              <th class="num">Gateway Fees (INR)</th>
              <th class="num">Net Settled (INR)</th>
              <th class="num">Volume Share</th>
            </tr>
          </thead>
          <tbody>
            ${(walletSummary.methodBreakdown || [])
              .map(
                (m) => `
              <tr>
                <td class="bold">${m.method}</td>
                <td class="num">${formatNumber(m.count)}</td>
                <td class="num">${formatINR(m.amount, 2)}</td>
                <td class="num">${formatINR(m.fee || 0, 2)}</td>
                <td class="num bold">${formatINR(m.netAmount || m.amount, 2)}</td>
                <td class="num">${m.share}</td>
              </tr>
            `
              )
              .join("")}
            <tr class="total-row">
              <td>TOTAL WALLET INFLOW</td>
              <td class="num">${formatNumber(walletSummary.rechargeCount || 0)}</td>
              <td class="num">${formatINR(walletSummary.totalDeposits, 2)}</td>
              <td class="num">-</td>
              <td class="num green">${formatINR(walletSummary.netInflow, 2)} (Net Inflow)</td>
              <td class="num">100.0%</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">4. Tax & GST Compliance Summary (SAC 998314)</div>
        <table>
          <thead>
            <tr>
              <th>State / Territory</th>
              <th class="num">Invoices</th>
              <th class="num">Taxable Amount (INR)</th>
              <th class="num">CGST (9%) (INR)</th>
              <th class="num">SGST (9%) (INR)</th>
              <th class="num">IGST (18%) (INR)</th>
              <th class="num">Total Tax (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${(gstSummary.stateBreakdown || [])
              .map(
                (s) => `
              <tr>
                <td class="bold">${s.state}</td>
                <td class="num">${formatNumber(s.invoices)}</td>
                <td class="num">${formatINR(s.taxable, 2)}</td>
                <td class="num">${formatINR(s.cgst, 2)}</td>
                <td class="num">${formatINR(s.sgst, 2)}</td>
                <td class="num">${formatINR(s.igst, 2)}</td>
                <td class="num bold blue">${formatINR(s.totalTax, 2)}</td>
              </tr>
            `
              )
              .join("")}
            <tr class="total-row">
              <td>GST TOTAL</td>
              <td class="num">${formatNumber(gstSummary.invoicesCount || 0)}</td>
              <td class="num">${formatINR(gstSummary.taxableTurnover, 2)}</td>
              <td class="num">${formatINR(gstSummary.cgst, 2)}</td>
              <td class="num">${formatINR(gstSummary.sgst, 2)}</td>
              <td class="num">${formatINR(gstSummary.igst, 2)}</td>
              <td class="num bold blue">${formatINR(gstSummary.totalTax, 2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">5. Top Spending Users</div>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>User ID</th>
              <th>User Name</th>
              <th>Email</th>
              <th>Role</th>
              <th class="num">Orders Placed</th>
              <th class="num">Total Spent (INR)</th>
              <th class="num">Wallet Balance (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${topUsers
              .map(
                (u) => `
              <tr>
                <td>#${u.rank}</td>
                <td class="bold">${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td class="num">${formatNumber(u.ordersCount)}</td>
                <td class="num bold">${formatINR(u.spent, 2)}</td>
                <td class="num">${formatINR(u.balance, 2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">6. Top Performing Services</div>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Service ID</th>
              <th>Service Name</th>
              <th>Category</th>
              <th>Provider</th>
              <th class="num">Orders Delivered</th>
              <th class="num">Gross Revenue (INR)</th>
              <th class="num">Net Profit (INR)</th>
              <th class="num">Margin (%)</th>
            </tr>
          </thead>
          <tbody>
            ${topServices
              .map(
                (s) => `
              <tr>
                <td>#${s.rank}</td>
                <td class="bold">${s.id}</td>
                <td>${s.name}</td>
                <td>${s.category}</td>
                <td>${s.provider}</td>
                <td class="num">${formatNumber(s.ordersCount)}</td>
                <td class="num bold">${formatINR(s.revenue, 2)}</td>
                <td class="num green">${formatINR(s.profit, 2)}</td>
                <td class="num">${s.margin}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">7. Provider Performance & Node Health</div>
        <table>
          <thead>
            <tr>
              <th>Provider Node</th>
              <th class="num">Orders Routed</th>
              <th class="num">Success Rate</th>
              <th class="num">Avg Fulfillment Time</th>
              <th>Health Status</th>
            </tr>
          </thead>
          <tbody>
            ${providerPerformance
              .map(
                (p) => `
              <tr>
                <td class="bold">${p.name}</td>
                <td class="num">${formatNumber(p.ordersSent)}</td>
                <td class="num green">${p.successRate}</td>
                <td class="num">${p.avgTime}</td>
                <td>${p.health || "Optimal"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
      `;

      const blob = new Blob([excelHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `gromage-financial-report-${range}-${dateTag}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      setExportOpen(false);
      addToast(
        `Financial report (${range.toUpperCase()}) exported as Excel (.xls)`,
        "success"
      );
    } catch {
      addToast("Failed to generate Excel export file", "error");
    }
  };

  // 3. Print / Save as PDF Export
  const handleExportPdf = () => {
    if (!data) {
      addToast("No report data available to export for this period", "error");
      return;
    }

    try {
      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
      const periodLabel = data?.periodLabel || range.toUpperCase();

      const printWindow = window.open("", "_blank", "width=1000,height=800");
      if (!printWindow) {
        addToast("Popup blocked! Please allow popups to print/export PDF", "error");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gromage Financial Report - ${range.toUpperCase()} - ${periodLabel}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; padding: 10px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
            .brand-name { font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
            .brand-tag { font-size: 11px; color: #64748b; margin-top: 2px; }
            .report-meta { text-align: right; font-size: 11px; color: #475569; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; background-color: #dbeafe; color: #1d4ed8; }
            
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .kpi-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
            .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; margin: 4px 0 2px 0; font-family: monospace; }
            .kpi-sub { font-size: 10px; color: #10b981; font-weight: 600; }
            
            .section-title { font-size: 13px; font-weight: 800; color: #0f172a; margin: 18px 0 8px 0; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
            th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 9.5px; }
            td { padding: 5.5px 8px; border: 1px solid #e2e8f0; }
            .num { text-align: right; font-family: monospace; }
            .bold { font-weight: 700; }
            .green { color: #059669; font-weight: 700; }
            .total-row { background-color: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; }
            
            .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand-name">GROMAGE SMM PANEL</div>
              <div class="brand-tag">Admin Financial & Operational Analytics Report</div>
            </div>
            <div class="report-meta">
              <span class="badge">${range.toUpperCase()} REPORT</span>
              <div style="margin-top: 4px;">Period: <strong>${periodLabel}</strong></div>
              <div>Generated: <strong>${nowStr} IST</strong></div>
            </div>
          </div>

          <!-- Section 1: KPI Summary -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Gross Sales</div>
              <div class="kpi-val">${formatINR(totals.totalSales, 2)}</div>
              <div class="kpi-sub">Total Revenue Volume</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Net Profit</div>
              <div class="kpi-val" style="color: #059669;">${formatINR(totals.totalProfit, 2)}</div>
              <div class="kpi-sub">${totals.profitMargin}% Net Margin</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Order Value</div>
              <div class="kpi-val" style="color: #0284c7;">${formatINR(totals.avgOrderValue, 2)}</div>
              <div class="kpi-sub">Per completed order</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Orders Delivered</div>
              <div class="kpi-val" style="color: #4f46e5;">${formatNumber(totals.ordersCompleted)}</div>
              <div class="kpi-sub">100% Automated</div>
            </div>
          </div>

          <!-- Section 2: Platform Sales Breakdown -->
          <div class="section-title">
            <span>Social Platform Sales Breakdown</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Platform Category</th>
                <th class="num">Gross Revenue</th>
                <th class="num">Revenue Share</th>
                <th class="num">Net Profit</th>
                <th class="num">Margin</th>
                <th class="num">Orders Delivered</th>
              </tr>
            </thead>
            <tbody>
              ${salesBreakdown
                .map(
                  (item) => `
                <tr>
                  <td class="bold">${item.category}</td>
                  <td class="num">${formatINR(item.revenue, 2)}</td>
                  <td class="num">${totals.totalSales > 0 ? ((item.revenue / totals.totalSales) * 100).toFixed(1) : 0}%</td>
                  <td class="num green">${formatINR(item.profit, 2)}</td>
                  <td class="num">${item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : 0}%</td>
                  <td class="num">${formatNumber(item.orders)}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td>TOTAL</td>
                <td class="num">${formatINR(totals.totalSales, 2)}</td>
                <td class="num">100.0%</td>
                <td class="num green">${formatINR(totals.totalProfit, 2)}</td>
                <td class="num">${totals.profitMargin}%</td>
                <td class="num">${formatNumber(totals.ordersCompleted)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Section 3: Wallet Analytics -->
          <div class="section-title">
            <span>Wallet Analytics & Payment Gateway Inflows</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Payment Gateway / Method</th>
                <th class="num">Transactions</th>
                <th class="num">Gross Deposits</th>
                <th class="num">Gateway Fee</th>
                <th class="num">Net Settled</th>
                <th class="num">Deposit Share</th>
              </tr>
            </thead>
            <tbody>
              ${(walletSummary.methodBreakdown || [])
                .map(
                  (m) => `
                <tr>
                  <td class="bold">${m.method}</td>
                  <td class="num">${formatNumber(m.count)}</td>
                  <td class="num">${formatINR(m.amount, 2)}</td>
                  <td class="num">${formatINR(m.fee || 0, 2)}</td>
                  <td class="num bold">${formatINR(m.netAmount || m.amount, 2)}</td>
                  <td class="num">${m.share}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td>TOTAL WALLET ACTIVITY</td>
                <td class="num">${formatNumber(walletSummary.rechargeCount || 0)}</td>
                <td class="num">${formatINR(walletSummary.totalDeposits, 2)}</td>
                <td class="num">-</td>
                <td class="num green">${formatINR(walletSummary.netInflow, 2)} (Net Inflow)</td>
                <td class="num">100.0%</td>
              </tr>
            </tbody>
          </table>

          <!-- Section 4: Tax & GST Compliance -->
          <div class="section-title">
            <span>GST & Tax Compliance Summary (SAC 998314 - 18% GST)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>State / Territory</th>
                <th class="num">Invoices</th>
                <th class="num">Taxable Turnover</th>
                <th class="num">CGST (9%)</th>
                <th class="num">SGST (9%)</th>
                <th class="num">IGST (18%)</th>
                <th class="num">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              ${(gstSummary.stateBreakdown || [])
                .map(
                  (s) => `
                <tr>
                  <td class="bold">${s.state}</td>
                  <td class="num">${formatNumber(s.invoices)}</td>
                  <td class="num">${formatINR(s.taxable, 2)}</td>
                  <td class="num">${formatINR(s.cgst, 2)}</td>
                  <td class="num">${formatINR(s.sgst, 2)}</td>
                  <td class="num">${formatINR(s.igst, 2)}</td>
                  <td class="num bold" style="color: #2563eb;">${formatINR(s.totalTax, 2)}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td>TOTAL TAX LIABILITY</td>
                <td class="num">${formatNumber(gstSummary.invoicesCount || 0)}</td>
                <td class="num">${formatINR(gstSummary.taxableTurnover, 2)}</td>
                <td class="num">${formatINR(gstSummary.cgst, 2)}</td>
                <td class="num">${formatINR(gstSummary.sgst, 2)}</td>
                <td class="num">${formatINR(gstSummary.igst, 2)}</td>
                <td class="num bold" style="color: #2563eb;">${formatINR(gstSummary.totalTax, 2)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Section 5: Top Users -->
          <div class="section-title">
            <span>Top Spending Platform Users</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Role</th>
                <th class="num">Orders</th>
                <th class="num">Total Spent</th>
                <th class="num">Wallet Balance</th>
              </tr>
            </thead>
            <tbody>
              ${topUsers
                .map(
                  (u) => `
                <tr>
                  <td>#${u.rank}</td>
                  <td class="bold">${u.id}</td>
                  <td>${u.name} (${u.email})</td>
                  <td>${u.role}</td>
                  <td class="num">${formatNumber(u.ordersCount)}</td>
                  <td class="num bold">${formatINR(u.spent, 2)}</td>
                  <td class="num">${formatINR(u.balance, 2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- Section 6: Top Services -->
          <div class="section-title">
            <span>Top Performing Services</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Service Name</th>
                <th>Category</th>
                <th>Provider Node</th>
                <th class="num">Orders Delivered</th>
                <th class="num">Gross Revenue</th>
                <th class="num">Net Profit</th>
                <th class="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              ${topServices
                .map(
                  (s) => `
                <tr>
                  <td>#${s.rank}</td>
                  <td class="bold">${s.name}</td>
                  <td>${s.category}</td>
                  <td>${s.provider}</td>
                  <td class="num">${formatNumber(s.ordersCount)}</td>
                  <td class="num bold">${formatINR(s.revenue, 2)}</td>
                  <td class="num green">${formatINR(s.profit, 2)}</td>
                  <td class="num">${s.margin}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- Section 7: Provider Performance -->
          <div class="section-title">
            <span>Provider Fulfillment & API Health</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Provider Node</th>
                <th class="num">Orders Routed</th>
                <th class="num">Success Rate</th>
                <th class="num">Avg Fulfillment Latency</th>
                <th>Node Health</th>
              </tr>
            </thead>
            <tbody>
              ${providerPerformance
                .map(
                  (p) => `
                <tr>
                  <td class="bold">${p.name}</td>
                  <td class="num">${formatNumber(p.ordersSent)}</td>
                  <td class="num green">${p.successRate}</td>
                  <td class="num">${p.avgTime}</td>
                  <td>${p.health || "Optimal"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="footer">
            <div>Confidential & Proprietary - Gromage SMM Panel Administration System</div>
            <div>Timezone: Asia/Kolkata (IST) | Page 1 of 1</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
      setExportOpen(false);
      addToast(
        `Print dialog opened for ${range.toUpperCase()} financial report`,
        "success"
      );
    } catch {
      addToast("Failed to initiate PDF print dialog", "error");
    }
  };

  // Helper for rendering provider health badge
  const renderHealthBadge = (prov) => {
    const health =
      prov.health ||
      (prov.successRateNum
        ? prov.successRateNum >= 98
          ? "Optimal"
          : prov.successRateNum >= 95
          ? "Good"
          : "Degraded"
        : parseFloat(prov.successRate || 0) >= 98
        ? "Optimal"
        : parseFloat(prov.successRate || 0) >= 95
        ? "Good"
        : "Degraded");

    if (health.toLowerCase().includes("optimal")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Optimal
        </span>
      );
    }
    if (health.toLowerCase().includes("good")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Good
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Degraded
      </span>
    );
  };

  return (
    <AdminLayout>
      {/* Page Header with Range Controls and Multi-Format Export */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <FaChartLine className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Reports & Financial Analytics
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Profit margin analysis, wallet inflows, GST compliance, and top performing services
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Range Selector */}
          <div
            className="flex bg-gray-100/90 p-1 rounded-xl border border-gray-200 text-xs font-semibold shadow-inner"
            role="group"
            aria-label="Report range selector"
          >
            {[
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
              { id: "yearly", label: "Yearly" },
            ].map((r) => {
              const isActive = range === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer font-bold ${
                    isActive
                      ? "bg-white text-blue-700 shadow-sm border border-gray-200/60"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Manual Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReport(true)}
            disabled={loading || refreshing}
            aria-label="Refresh report data"
            title="Refresh analytics data"
            icon={
              <FaSync
                className={refreshing ? "animate-spin text-blue-600" : ""}
              />
            }
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Multi-Format Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <Button
              variant="primary"
              size="sm"
              icon={<FaFileExport />}
              onClick={() => setExportOpen((prev) => !prev)}
              disabled={loading || !data}
              aria-label="Export reports in CSV, Excel, or PDF format"
              title="Export report"
            >
              <span>Export</span>
              <FaChevronDown className="text-[10px] ml-1 opacity-80" />
            </Button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-30 divide-y divide-gray-100">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Select Export Format
                </div>

                <div className="py-1">
                  <button
                    onClick={handleExportCsv}
                    className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FaFileCsv className="text-emerald-600 text-sm flex-shrink-0" />
                    <div>
                      <div className="font-bold">Export CSV</div>
                      <div className="text-[10px] text-gray-400">Multi-section tabular data</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FaFileExcel className="text-green-600 text-sm flex-shrink-0" />
                    <div>
                      <div className="font-bold">Export Excel (.xls)</div>
                      <div className="text-[10px] text-gray-400">Formatted workbook tables</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportPdf}
                    className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FaFilePdf className="text-rose-600 text-sm flex-shrink-0" />
                    <div>
                      <div className="font-bold">Print / Save PDF</div>
                      <div className="text-[10px] text-gray-400">Clean branded A4 format</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Period Banner */}
      {data?.periodLabel && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium">
          <div className="flex items-center gap-2">
            <FaCalendarAlt className="text-blue-600 text-sm flex-shrink-0" />
            <span>
              Active Period: <strong>{data.periodLabel}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-700 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200/60">
              Tax Rule: SAC 998314 (18% GST)
            </span>
            <span className="text-[11px] text-blue-700 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200/60">
              Timezone: Asia/Kolkata (IST)
            </span>
          </div>
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-xl text-rose-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Failed to Load Report Data</h4>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => fetchReport(false)}
            icon={<FaRedo />}
            className="border-rose-300 text-rose-700 hover:bg-rose-100 flex-shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton States */}
      {loading && !data ? (
        <div className="space-y-6">
          {/* KPI Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3"
              >
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>

          {/* Chart Skeleton */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>

          {/* Table Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <Skeleton className="h-5 w-56" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <Skeleton className="h-5 w-56" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : !data || (salesBreakdown.length === 0 && providerPerformance.length === 0) ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaChartBar className="text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            No Report Data Available
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1.5">
            There are no recorded transactions or fulfillment events for the selected{" "}
            <span className="font-semibold text-gray-700 capitalize">{range}</span> period.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<FaSync />}
              onClick={() => fetchReport(true)}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRange("monthly")}
            >
              View Monthly Report
            </Button>
          </div>
        </div>
      ) : (
        /* Populated Report Content */
        <>
          {/* ========================================================= */}
          {/* SECTION 1: Summary Financial KPI Cards */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* 1. Gross Sales */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Gross Sales
                </p>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FaMoneyBillWave className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mt-2 font-mono tracking-tight">
                {formatINR(totals.totalSales, 2)}
              </h3>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                {growthMetrics?.salesGrowth !== null &&
                growthMetrics?.salesGrowth !== undefined ? (
                  Number(growthMetrics.salesGrowth) >= 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      <FaArrowUp className="text-[10px]" />
                      +{growthMetrics.salesGrowth}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                      <FaArrowDown className="text-[10px]" />
                      {growthMetrics.salesGrowth}%
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 font-medium text-[11px]">
                    Current selected period
                  </span>
                )}
                <span className="text-[11px] text-gray-500 truncate">
                  vs previous {range}
                </span>
              </div>
            </div>

            {/* 2. Net Profit */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Net Profit
                </p>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FaPercentage className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono tracking-tight">
                {formatINR(totals.totalProfit, 2)}
              </h3>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  <FaCheckCircle className="text-[10px]" />
                  {totals.profitMargin}%
                </span>
                <span className="text-[11px] text-gray-500">net profit margin</span>
              </div>
            </div>

            {/* 3. Average Order Value */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Avg Order Value
                </p>
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <FaShoppingBag className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-sky-600 mt-2 font-mono tracking-tight">
                {formatINR(totals.avgOrderValue, 2)}
              </h3>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                {growthMetrics?.aovGrowth !== null &&
                growthMetrics?.aovGrowth !== undefined ? (
                  Number(growthMetrics.aovGrowth) >= 0 ? (
                    <span className="inline-flex items-center gap-1 text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                      <FaArrowUp className="text-[10px]" />
                      +{growthMetrics.aovGrowth}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                      <FaArrowDown className="text-[10px]" />
                      {growthMetrics.aovGrowth}%
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 font-medium text-[11px]">
                    Per completed order
                  </span>
                )}
                <span className="text-[11px] text-gray-500 truncate">
                  across all platforms
                </span>
              </div>
            </div>

            {/* 4. Orders Delivered */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Orders Delivered
                </p>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FaCheckCircle className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2 font-mono tracking-tight">
                {formatNumber(totals.ordersCompleted)}
              </h3>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                {growthMetrics?.ordersGrowth !== null &&
                growthMetrics?.ordersGrowth !== undefined ? (
                  Number(growthMetrics.ordersGrowth) >= 0 ? (
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                      <FaArrowUp className="text-[10px]" />
                      +{growthMetrics.ordersGrowth}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                      <FaArrowDown className="text-[10px]" />
                      {growthMetrics.ordersGrowth}%
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 font-medium text-[11px]">
                    Delivered in period
                  </span>
                )}
                <span className="text-[11px] text-gray-500 truncate">
                  automated fulfillment
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: Platform Revenue & Profit Chart */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FaChartBar className="text-blue-600" />
                  Revenue & Net Profit by Platform (INR ₹)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Comparison between gross revenue and retained profit per social media channel
                </p>
              </div>

              {/* Chart Legend Summary */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="w-3 h-3 rounded-sm bg-blue-600" />
                  <span>Gross Revenue</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span>Net Profit</span>
                </div>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            {salesBreakdown.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <FaChartBar className="text-3xl mb-2 text-gray-300" />
                <p className="text-xs">No platform breakdown data available</p>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesBreakdown}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="category"
                      stroke="#64748b"
                      fontSize={12}
                      fontWeight={500}
                      tickLine={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactINR}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ display: "none" }} />
                    <Bar
                      dataKey="revenue"
                      name="Gross Revenue"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar
                      dataKey="profit"
                      name="Net Profit"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: Platform Sales Breakdown Table */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FaTable className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Platform Sales Breakdown & Margins
                  </h3>
                  <p className="text-xs text-gray-500">
                    Detailed distribution of orders, volume, and profit margins across social channels
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Platform / Category</th>
                    <th className="py-3 px-4 text-right">Gross Revenue</th>
                    <th className="py-3 px-4 text-right">Revenue Share</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-right">Profit Margin</th>
                    <th className="py-3 px-4 text-right">Orders Delivered</th>
                    <th className="py-3 px-4 text-right">Avg Order Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {salesBreakdown.map((item, idx) => {
                    const rev = Number(item.revenue) || 0;
                    const prof = Number(item.profit) || 0;
                    const ord = Number(item.orders) || 0;
                    const share =
                      totals.totalSales > 0
                        ? ((rev / totals.totalSales) * 100).toFixed(1)
                        : "0.0";
                    const margin =
                      rev > 0 ? ((prof / rev) * 100).toFixed(1) : "0.0";
                    const aov = ord > 0 ? rev / ord : 0;
                    const iconConfig = getPlatformIcon(item.category);

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`p-1.5 rounded-lg border text-sm flex-shrink-0 ${iconConfig.bg}`}
                            >
                              {iconConfig.icon}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {item.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {formatINR(rev, 2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-semibold bg-gray-100 text-gray-700">
                            {share}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatINR(prof, 2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {margin}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-800">
                          {formatNumber(ord)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-600">
                          {formatINR(aov, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Calculated Totals Row */}
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 text-gray-900 font-bold text-xs">
                    <td className="py-3 px-4 uppercase tracking-wider font-extrabold">
                      Total / Summary
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-gray-900 text-sm">
                      {formatINR(totals.totalSales, 2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">100.0%</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                      {formatINR(totals.totalProfit, 2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                      {totals.profitMargin}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-700">
                      {formatNumber(totals.ordersCompleted)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-800">
                      {formatINR(totals.avgOrderValue, 2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 4: Wallet Analytics & Payment Gateways */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FaWallet className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Wallet Analytics & Payment Gateway Inflows
                  </h3>
                  <p className="text-xs text-gray-500">
                    Platform deposits, wallet spending, net inflow, and payment gateway distribution
                  </p>
                </div>
              </div>
            </div>

            {/* Wallet Summary KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Deposits */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Total Deposits
                </span>
                <div className="text-xl font-black font-mono text-emerald-800 mt-1">
                  {formatINR(walletSummary.totalDeposits, 2)}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">
                  {formatNumber(walletSummary.rechargeCount)} recharge events
                </div>
              </div>

              {/* Total Spent */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  Spent from Wallets
                </span>
                <div className="text-xl font-black font-mono text-blue-800 mt-1">
                  {formatINR(walletSummary.totalSpent, 2)}
                </div>
                <div className="text-[11px] text-blue-600 mt-0.5">
                  Orders debit volume
                </div>
              </div>

              {/* Net Platform Inflow */}
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  Net Platform Inflow
                </span>
                <div className="text-xl font-black font-mono text-indigo-800 mt-1">
                  {formatINR(walletSummary.netInflow, 2)}
                </div>
                <div className="text-[11px] text-indigo-600 mt-0.5">
                  Deposits minus spending
                </div>
              </div>

              {/* Platform Outstanding Balance */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Platform Balance Liability
                </span>
                <div className="text-xl font-black font-mono text-amber-800 mt-1">
                  {formatINR(walletSummary.totalPlatformBalance, 2)}
                </div>
                <div className="text-[11px] text-amber-600 mt-0.5">
                  Total active user balances
                </div>
              </div>
            </div>

            {/* Payment Method Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead>
                  <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Payment Method / Gateway</th>
                    <th className="py-3 px-4 text-right">Transactions</th>
                    <th className="py-3 px-4 text-right">Gross Volume</th>
                    <th className="py-3 px-4 text-right">Gateway Fees</th>
                    <th className="py-3 px-4 text-right">Net Settled</th>
                    <th className="py-3 px-4 text-right">Volume Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {(walletSummary.methodBreakdown || []).map((m, idx) => {
                    const iconConfig = getPaymentMethodIcon(m.method);
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-emerald-50/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`p-1.5 rounded-lg border text-sm flex-shrink-0 ${iconConfig.bg}`}
                            >
                              {iconConfig.icon}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {m.method}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-800">
                          {formatNumber(m.count)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {formatINR(m.amount, 2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600">
                          {m.fee > 0 ? formatINR(m.fee, 2) : "₹0.00"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatINR(m.netAmount || m.amount, 2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-semibold bg-gray-100 text-gray-700">
                            {m.share}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 5: Tax & GST Compliance Summary */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FaReceipt className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Tax & GST Compliance Report (SAC 998314 - 18% GST)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Taxable turnover, CGST, SGST, IGST liability, and regional distribution
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <FaShieldAlt className="text-blue-600" />
                  HSN / SAC: 998314
                </span>
              </div>
            </div>

            {/* GST Summary KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
              {/* Taxable Turnover */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Taxable Turnover
                </span>
                <div className="text-lg font-black font-mono text-gray-900 mt-1">
                  {formatINR(gstSummary.taxableTurnover, 2)}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Excl. GST</div>
              </div>

              {/* CGST (9%) */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  CGST (9%)
                </span>
                <div className="text-lg font-black font-mono text-blue-700 mt-1">
                  {formatINR(gstSummary.cgst, 2)}
                </div>
                <div className="text-[10px] text-blue-500 mt-0.5">Intra-State Central</div>
              </div>

              {/* SGST (9%) */}
              <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100">
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                  SGST (9%)
                </span>
                <div className="text-lg font-black font-mono text-sky-700 mt-1">
                  {formatINR(gstSummary.sgst, 2)}
                </div>
                <div className="text-[10px] text-sky-500 mt-0.5">Intra-State State</div>
              </div>

              {/* IGST (18%) */}
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                  IGST (18%)
                </span>
                <div className="text-lg font-black font-mono text-indigo-700 mt-1">
                  {formatINR(gstSummary.igst, 2)}
                </div>
                <div className="text-[10px] text-indigo-500 mt-0.5">Inter-State Integrated</div>
              </div>

              {/* Total GST Collected */}
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                  Total Tax Collected
                </span>
                <div className="text-lg font-black font-mono text-purple-900 mt-1">
                  {formatINR(gstSummary.totalTax, 2)}
                </div>
                <div className="text-[10px] text-purple-600 mt-0.5">
                  {formatNumber(gstSummary.invoicesCount)} invoices
                </div>
              </div>
            </div>

            {/* Regional GST Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">State / Territory (Place of Supply)</th>
                    <th className="py-3 px-4 text-right">Invoices</th>
                    <th className="py-3 px-4 text-right">Taxable Turnover</th>
                    <th className="py-3 px-4 text-right">CGST (9%)</th>
                    <th className="py-3 px-4 text-right">SGST (9%)</th>
                    <th className="py-3 px-4 text-right">IGST (18%)</th>
                    <th className="py-3 px-4 text-right">Total Tax Liability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {(gstSummary.stateBreakdown || []).map((s, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900">{s.state}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-gray-700">
                        {formatNumber(s.invoices)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {formatINR(s.taxable, 2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-600">
                        {s.cgst > 0 ? formatINR(s.cgst, 2) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sky-600">
                        {s.sgst > 0 ? formatINR(s.sgst, 2) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-600">
                        {s.igst > 0 ? formatINR(s.igst, 2) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                        {formatINR(s.totalTax, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 6: Top Users & Top Services Leaderboards */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Spending Users Leaderboard */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <FaCrown className="text-base" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Top Spending Platform Users
                      </h3>
                      <p className="text-xs text-gray-500">
                        Highest volume accounts ranked by gross spending
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    <FaUsers className="inline mr-1" />
                    Top {topUsers.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[480px]">
                    <thead>
                      <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3 text-right">Orders</th>
                        <th className="py-2.5 px-3 text-right">Total Spent</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                      {topUsers.map((u, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-amber-50/30 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                                u.rank === 1
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : u.rank === 2
                                  ? "bg-slate-200 text-slate-800 border border-slate-300"
                                  : u.rank === 3
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {u.rank}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.role === "Reseller" && (
                                  <Badge variant="purple" size="xs">
                                    Reseller
                                  </Badge>
                                )}
                                {u.role === "VIP User" && (
                                  <Badge variant="info" size="xs">
                                    VIP
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                {u.id} • {u.email}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-gray-800">
                            {formatNumber(u.ordersCount)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                            {formatINR(u.spent, 2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">
                            {formatINR(u.balance, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Top Performing Services Leaderboard */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <FaBoxes className="text-base" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Top Performing Services
                      </h3>
                      <p className="text-xs text-gray-500">
                        Most popular services by order count and gross profit
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    <FaStar className="inline mr-1 text-amber-500" />
                    Top {topServices.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Service Name</th>
                        <th className="py-2.5 px-3 text-right">Orders</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Profit</th>
                        <th className="py-2.5 px-3 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                      {topServices.map((s, idx) => {
                        const iconConfig = getPlatformIcon(s.category);
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-purple-50/30 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                                  s.rank === 1
                                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                                    : s.rank === 2
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {s.rank}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div>
                                <div className="font-bold text-gray-900 line-clamp-1 max-w-[200px]" title={s.name}>
                                  {s.name}
                                </div>
                                <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                  <span className="inline-flex items-center gap-1">
                                    {iconConfig.icon}
                                    <span>{s.category}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="text-gray-500">{s.provider}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-gray-800">
                              {formatNumber(s.ordersCount)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                              {formatINR(s.revenue, 2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                              {formatINR(s.profit, 2)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                {s.margin}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 7: Provider Performance & API Health */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FaServer className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Provider Performance & API Success Rates
                  </h3>
                  <p className="text-xs text-gray-500">
                    Real-time fulfillment metrics, order routing latency, and server health
                  </p>
                </div>
              </div>
            </div>

            {providerPerformance.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <p className="text-xs">No provider performance data available for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead>
                    <tr className="bg-gray-50/80 border-y border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">Provider Node</th>
                      <th className="py-3 px-4 text-right">Orders Routed</th>
                      <th className="py-3 px-4 text-right">Volume Share</th>
                      <th className="py-3 px-4 text-right">Success Rate</th>
                      <th className="py-3 px-4 text-right">Avg Fulfillment Latency</th>
                      <th className="py-3 px-4 text-center">Node Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {providerPerformance.map((prov, i) => {
                      const sent = Number(prov.ordersSent) || 0;
                      const share =
                        totals.totalProviderOrders > 0
                          ? ((sent / totals.totalProviderOrders) * 100).toFixed(1)
                          : "0.0";

                      return (
                        <tr
                          key={i}
                          className="hover:bg-gray-50/70 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="font-bold text-gray-900">
                                {prov.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                            {formatNumber(sent)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-semibold bg-gray-100 text-gray-700">
                              {share}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-bold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              {prov.successRate}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600 font-mono font-semibold">
                            {prov.avgTime}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {renderHealthBadge(prov)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 text-gray-900 font-bold text-xs">
                      <td className="py-3 px-4 uppercase tracking-wider font-extrabold">
                        Total Orders Routed
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-gray-900 text-sm">
                        {formatNumber(totals.totalProviderOrders)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">100.0%</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        {providerPerformance.length > 0
                          ? `${(
                              providerPerformance.reduce(
                                (acc, curr) =>
                                  acc + (parseFloat(curr.successRate) || 0),
                                0
                              ) / providerPerformance.length
                            ).toFixed(1)}% Avg`
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">
                        -
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success" size="xs">
                          All Online
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminReports;
