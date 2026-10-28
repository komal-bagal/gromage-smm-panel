/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FaReply,
  FaCheckCircle,
  FaTimesCircle,
  FaPaperPlane,
  FaSync,
  FaHeadset,
  FaInbox,
  FaClock,
  FaUndo,
  FaTimes,
  FaUser,
  FaPaperclip,
  FaFile,
  FaFileImage,
  FaFilePdf,
  FaFileCode,
  FaFileAlt,
  FaDownload,
  FaEye,
  FaPlus,
  FaImage,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const STATUS_OPTIONS = ["all", "Open", "Answered", "Closed"];
const PRIORITY_OPTIONS = ["all", "Urgent", "High", "Medium", "Low"];

function AdminTickets() {
  const { addToast } = useToast();

  // Primary Data State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Conversation Modal & Reply State
  const [activeTicket, setActiveTicket] = useState(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  // Attachments State & Preview Modal
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const fileInputRef = useRef(null);

  // Scroll ref for chat modal
  const messagesEndRef = useRef(null);

  // -------------------------------------------------------------
  // File & Attachment Helpers
  // -------------------------------------------------------------
  const getFileIcon = (extension = "", mimeType = "") => {
    const ext = (extension || "").toLowerCase();
    const mime = (mimeType || "").toLowerCase();

    if (
      ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext) ||
      mime.startsWith("image/")
    ) {
      return <FaFileImage className="text-blue-500" />;
    }
    if (ext === "pdf" || mime === "application/pdf") {
      return <FaFilePdf className="text-rose-500" />;
    }
    if (
      ["json", "js", "html", "css", "ts", "jsx", "tsx", "xml"].includes(ext) ||
      mime.includes("json") ||
      mime.includes("javascript")
    ) {
      return <FaFileCode className="text-amber-500" />;
    }
    if (
      ["txt", "csv", "log", "md", "doc", "docx"].includes(ext) ||
      mime.startsWith("text/")
    ) {
      return <FaFileAlt className="text-slate-500" />;
    }
    return <FaFile className="text-gray-400" />;
  };

  const formatBytes = (bytes) => {
    if (typeof bytes === "string") return bytes;
    if (!bytes || isNaN(bytes)) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownloadAttachment = (att) => {
    if (!att) return;
    try {
      let content = `Gromage SMM Panel Mock File: ${att.name}\nSize: ${att.size || "Unknown"}\nUploaded By: ${att.uploadedBy || "User"}\nUploaded At: ${att.uploadedAt || new Date().toISOString()}\n\n[Simulated attachment payload for Admin support review]`;
      let mime = att.type || "text/plain";

      if (att.extension === "json" || (att.name && att.name.endsWith(".json"))) {
        content = JSON.stringify(
          {
            ticketId: activeTicket?.id,
            attachmentId: att.id,
            filename: att.name,
            timestamp: att.uploadedAt || new Date().toISOString(),
            status: "SimulatedPayload",
            payload: { code: "RATE_LIMIT_EXCEEDED", limit: 500, burstAllowed: true },
          },
          null,
          2
        );
        mime = "application/json";
      } else if (
        ["png", "jpg", "jpeg", "webp"].includes(att.extension?.toLowerCase())
      ) {
        content = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">
          <rect width="100%" height="100%" fill="#1e293b"/>
          <text x="50%" y="45%" fill="#38bdf8" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">Gromage SMM Panel - Mock Attachment</text>
          <text x="50%" y="58%" fill="#94a3b8" font-family="monospace" font-size="14" text-anchor="middle">${att.name} (${att.size || "Image"})</text>
          <text x="50%" y="70%" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">Verified by Admin Support Node</text>
        </svg>`;
        mime = "image/svg+xml";
      }

      const blob = new Blob([content], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = att.name || "attachment.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      addToast(`Downloaded attachment: ${att.name}`, "success");
    } catch (err) {
      console.error("Download error:", err);
      addToast("Failed to initiate file download", "error");
    }
  };

  const handleOpenPreview = (att) => {
    setPreviewAttachment(att);
    setPreviewModalOpen(true);
  };

  const handleFileSelect = (e) => {
    setAttachmentError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedExtensions = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "pdf",
      "txt",
      "csv",
      "json",
      "doc",
      "docx",
    ];
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    const MAX_TOTAL_FILES = 5;

    if (pendingAttachments.length + files.length > MAX_TOTAL_FILES) {
      setAttachmentError(`Maximum ${MAX_TOTAL_FILES} attachments allowed per reply.`);
      addToast(`Maximum ${MAX_TOTAL_FILES} attachments allowed`, "warning");
      e.target.value = "";
      return;
    }

    const newAttachments = [];
    for (const file of files) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        setAttachmentError(`File "${file.name}" has an unsupported format (.${ext}).`);
        addToast(`Unsupported file type: .${ext}`, "error");
        e.target.value = "";
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setAttachmentError(`File "${file.name}" exceeds the 5MB size limit (${formatBytes(file.size)}).`);
        addToast(`File exceeds 5MB size limit`, "error");
        e.target.value = "";
        return;
      }

      newAttachments.push({
        id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: formatBytes(file.size),
        sizeBytes: file.size,
        type: file.type || `application/${ext}`,
        extension: ext,
        uploadedBy: "Support Staff (Admin)",
        uploadedAt: "Just now",
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const handleAddSampleProof = () => {
    setAttachmentError(null);
    const sampleOptions = [
      {
        name: "provider_delivery_log_refill.png",
        size: "380 KB",
        sizeBytes: 389120,
        type: "image/png",
        extension: "png",
        url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
      },
      {
        name: "bank_settlement_reconciliation.pdf",
        size: "740 KB",
        sizeBytes: 757760,
        type: "application/pdf",
        extension: "pdf",
        url: null,
      },
      {
        name: "api_gateway_burst_trace.json",
        size: "18 KB",
        sizeBytes: 18432,
        type: "application/json",
        extension: "json",
        url: null,
      },
    ];

    const sample = sampleOptions[pendingAttachments.length % sampleOptions.length];
    const newAtt = {
      id: `ATT-SMP-${Date.now()}`,
      name: sample.name,
      size: sample.size,
      sizeBytes: sample.sizeBytes,
      type: sample.type,
      extension: sample.extension,
      uploadedBy: "Support Staff (Admin)",
      uploadedAt: "Just now",
      url: sample.url,
    };

    setPendingAttachments((prev) => [...prev, newAtt]);
    addToast(`Added demo attachment: ${sample.name}`, "info");
  };

  const handleRemovePendingAttachment = (indexToRemove) => {
    setPendingAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // -------------------------------------------------------------
  // Fetch Tickets
  // -------------------------------------------------------------
  const fetchTickets = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const data = await adminService.getTickets();
        setTickets(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("Support tickets list refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load support tickets:", err);
        setFetchError("Failed to load support tickets. Please try again.");
        addToast("Failed to load support tickets", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Scroll to bottom of message thread whenever messages change or modal opens
  useEffect(() => {
    if (chatModalOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatModalOpen, activeTicket?.messages]);

  // -------------------------------------------------------------
  // Summary Metrics (Dynamically Calculated)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(
      (t) => (t.status || "").toLowerCase() === "open"
    ).length;
    const answered = tickets.filter(
      (t) => (t.status || "").toLowerCase() === "answered"
    ).length;
    const closed = tickets.filter(
      (t) => (t.status || "").toLowerCase() === "closed"
    ).length;
    return { total, open, answered, closed };
  }, [tickets]);

  // -------------------------------------------------------------
  // Unique Departments from Data
  // -------------------------------------------------------------
  const departmentOptions = useMemo(() => {
    const depts = new Set(["Orders", "Payments", "API"]);
    tickets.forEach((t) => {
      if (t.department) depts.add(t.department);
    });
    return ["all", ...Array.from(depts)];
  }, [tickets]);

  // -------------------------------------------------------------
  // Filtered Tickets
  // -------------------------------------------------------------
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.user && t.user.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (t.status || "").toLowerCase() === statusFilter.toLowerCase();

      const matchesDept =
        deptFilter === "all" ||
        (t.department || "").toLowerCase() === deptFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "all" ||
        (t.priority || "").toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesDept && matchesPriority;
    });
  }, [tickets, search, statusFilter, deptFilter, priorityFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    deptFilter !== "all" ||
    priorityFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDeptFilter("all");
    setPriorityFilter("all");
  };

  // -------------------------------------------------------------
  // Open Conversation Thread
  // -------------------------------------------------------------
  const handleOpenChat = async (tck) => {
    setLoadingChat(true);
    setChatModalOpen(true);
    setPendingAttachments([]);
    setAttachmentError(null);
    try {
      const details = await adminService.getTicketDetails(tck.id);
      setActiveTicket(details || tck);
    } catch {
      setActiveTicket(tck);
      addToast("Loaded ticket with cached messages", "info");
    } finally {
      setLoadingChat(false);
    }
  };

  // -------------------------------------------------------------
  // Send Reply
  // -------------------------------------------------------------
  const handleSendReply = async (e) => {
    e.preventDefault();
    const cleanMsg = replyMessage.trim();
    if (!cleanMsg && pendingAttachments.length === 0) return;
    if (!activeTicket) return;

    setIsReplying(true);
    try {
      const res = await adminService.replyTicket(activeTicket.id, {
        text: cleanMsg,
        attachments: pendingAttachments,
      });

      const newMsg = res?.message || {
        id: Date.now(),
        sender: "Support Staff (Admin)",
        role: "admin",
        text: cleanMsg,
        attachments: pendingAttachments,
        time: "Just now",
      };

      const updatedMessages = [...(activeTicket.messages || []), newMsg];
      const existingTicketAttachments = Array.isArray(activeTicket.attachments)
        ? activeTicket.attachments
        : [];
      const updatedTicketAttachments = [
        ...existingTicketAttachments,
        ...pendingAttachments,
      ];

      setActiveTicket((prev) => ({
        ...prev,
        status: "Answered",
        messages: updatedMessages,
        attachments: updatedTicketAttachments,
        messagesCount: updatedMessages.length,
        lastUpdated: "Just now",
      }));

      setTickets((prev) =>
        prev.map((t) =>
          t.id === activeTicket.id
            ? {
                ...t,
                status: "Answered",
                messages: updatedMessages,
                attachments: updatedTicketAttachments,
                messagesCount: updatedMessages.length,
                lastUpdated: "Just now",
              }
            : t
        )
      );

      setReplyMessage("");
      setPendingAttachments([]);
      setAttachmentError(null);
      addToast("Reply dispatched to customer", "success");
    } catch {
      addToast("Failed to send reply", "error");
    } finally {
      setIsReplying(false);
    }
  };

  // -------------------------------------------------------------
  // Change Status (Close / Reopen)
  // -------------------------------------------------------------
  const handleStatusChange = async (ticketId, newStatus) => {
    if (statusLoadingId === ticketId) return;

    setStatusLoadingId(ticketId);
    try {
      await adminService.updateTicketStatus(ticketId, newStatus);

      if (activeTicket && activeTicket.id === ticketId) {
        setActiveTicket((prev) => ({
          ...prev,
          status: newStatus,
          lastUpdated: "Just now",
        }));
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: newStatus, lastUpdated: "Just now" }
            : t
        )
      );

      addToast(`Ticket #${ticketId} marked as ${newStatus}`, "success");
    } catch {
      addToast("Failed to update ticket status", "error");
    } finally {
      setStatusLoadingId(null);
    }
  };

  // -------------------------------------------------------------
  // Priority Badge Renderer
  // -------------------------------------------------------------
  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case "Urgent":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-rose-500 animate-pulse" />
            Urgent
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-500" />
            High
          </span>
        );
      case "Medium":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-blue-500" />
            Medium
          </span>
        );
      case "Low":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-gray-400" />
            {priority || "Normal"}
          </span>
        );
    }
  };

  // -------------------------------------------------------------
  // Table Columns
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Ticket ID",
      accessor: "id",
      render: (row) => (
        <span className="font-mono font-bold text-xs text-blue-600">
          #{row.id}
        </span>
      ),
    },
    {
      header: "Customer",
      accessor: "user",
      render: (row) => (
        <div>
          <span className="font-semibold text-xs text-gray-900 block">
            {row.user}
          </span>
          {row.email && (
            <span className="text-[11px] text-gray-400 block">{row.email}</span>
          )}
        </div>
      ),
    },
    {
      header: "Subject",
      accessor: "subject",
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-xs text-gray-900 truncate">
            {row.subject}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-block px-1.5 py-0.2 bg-gray-100 text-gray-600 font-mono rounded text-[10px]">
              {row.messages ? row.messages.length : row.messagesCount || 1} msg
              {(row.messages?.length || row.messagesCount || 1) > 1 ? "s" : ""}
            </span>
            {row.attachments && row.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-blue-50 text-blue-700 font-mono rounded text-[10px] border border-blue-200">
                <FaPaperclip className="text-[8px]" />
                {row.attachments.length} {row.attachments.length === 1 ? "file" : "files"}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Department",
      accessor: "department",
      render: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 border border-gray-200">
          {row.department || "General"}
        </span>
      ),
    },
    {
      header: "Priority",
      accessor: "priority",
      render: (row) => renderPriorityBadge(row.priority),
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      header: "Last Update",
      accessor: "lastUpdated",
      render: (row) => (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <FaClock className="text-[10px] text-gray-400" />
          <span>{row.lastUpdated || row.createdAt || "Recent"}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => handleOpenChat(row)}
            icon={<FaReply className="text-blue-600" />}
            title="Open Conversation Thread"
          >
            Open Thread
          </Button>

          {row.status === "Closed" ? (
            <Button
              size="xs"
              variant="ghost"
              isLoading={statusLoadingId === row.id}
              onClick={() => handleStatusChange(row.id, "Open")}
              icon={<FaUndo className="text-emerald-600" />}
              title="Reopen Ticket"
            >
              Reopen
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              isLoading={statusLoadingId === row.id}
              onClick={() => handleStatusChange(row.id, "Closed")}
              icon={<FaTimesCircle className="text-rose-500" />}
              title="Close Ticket"
            >
              Close
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Support Ticketing
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Resolve customer queries, payment claims, and order refill tickets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<FaSync />}
            isLoading={refreshing}
            onClick={() => fetchTickets(true)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {/* Total Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Total Tickets
            </p>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">
              <FaHeadset />
            </div>
          </div>
          <h3 className="text-2xl font-black text-gray-900 mt-2">
            {metrics.total}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">All support threads</p>
        </button>

        {/* Open Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter("Open")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "Open"
              ? "bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Open Tickets
            </p>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs">
              <FaInbox />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2">
            {metrics.open}
          </h3>
          <p className="text-[11px] text-rose-500 mt-1">Requires attention</p>
        </button>

        {/* Answered Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter("Answered")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "Answered"
              ? "bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Answered
            </p>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs">
              <FaReply />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 mt-2">
            {metrics.answered}
          </h3>
          <p className="text-[11px] text-amber-600 mt-1">Awaiting user response</p>
        </button>

        {/* Closed Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter("Closed")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "Closed"
              ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Closed
            </p>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs">
              <FaCheckCircle />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">
            {metrics.closed}
          </h3>
          <p className="text-[11px] text-emerald-600 mt-1">Resolved issues</p>
        </button>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTimesCircle className="text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{fetchError}</span>
          </div>
          <Button size="xs" variant="danger" onClick={() => fetchTickets(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={filteredTickets}
        isLoading={loading}
        searchable={true}
        searchPlaceholder="Search by ID, customer name, email, or subject..."
        searchValue={search}
        onSearch={setSearch}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.filter((s) => s !== "all").map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "all" ? "All Departments" : dept}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              {PRIORITY_OPTIONS.filter((p) => p !== "all").map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            {/* Reset Filter Button */}
            {hasActiveFilters && (
              <Button
                size="xs"
                variant="ghost"
                onClick={handleResetFilters}
                icon={<FaTimes />}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear Filters
              </Button>
            )}
          </div>
        }
        emptyTitle="No support tickets found"
        emptySubtitle={
          hasActiveFilters
            ? "Try adjusting your search criteria or clearing active filters."
            : "No support tickets have been submitted yet."
        }
      />

      {/* Ticket Conversation Modal */}
      <Modal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="font-mono text-blue-600 font-bold">
              #{activeTicket?.id}
            </span>
            <span className="text-gray-900 truncate">
              {activeTicket?.subject}
            </span>
          </div>
        }
        subtitle={
          activeTicket
            ? `From ${activeTicket.user}${
                activeTicket.email ? ` (${activeTicket.email})` : ""
              } • Created: ${activeTicket.createdAt || "Recent"}`
            : ""
        }
        size="2xl"
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeTicket?.status !== "Closed" ? (
                <Button
                  size="xs"
                  variant="danger"
                  isLoading={statusLoadingId === activeTicket?.id}
                  onClick={() =>
                    activeTicket && handleStatusChange(activeTicket.id, "Closed")
                  }
                  icon={<FaTimesCircle />}
                >
                  Close Ticket
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="success"
                  isLoading={statusLoadingId === activeTicket?.id}
                  onClick={() =>
                    activeTicket && handleStatusChange(activeTicket.id, "Open")
                  }
                  icon={<FaUndo />}
                >
                  Reopen Ticket
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setChatModalOpen(false)}
            >
              Close Window
            </Button>
          </div>
        }
      >
        {activeTicket && (
          <div className="space-y-4">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-gray-500">Dept:</span>
                <span className="px-2 py-0.5 bg-white border border-gray-300 rounded font-semibold text-gray-800">
                  {activeTicket.department || "General"}
                </span>

                <span className="font-semibold text-gray-500 ml-2">
                  Priority:
                </span>
                {renderPriorityBadge(activeTicket.priority)}

                {activeTicket.attachments && activeTicket.attachments.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200 text-xs ml-2">
                    <FaPaperclip className="text-xs" />
                    {activeTicket.attachments.length}{" "}
                    {activeTicket.attachments.length === 1
                      ? "Attachment"
                      : "Attachments"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">
                  Status:
                </span>
                <Badge status={activeTicket.status} size="xs" />
              </div>
            </div>

            {/* Ticket Attachments Overview Section */}
            {activeTicket.attachments && activeTicket.attachments.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FaPaperclip className="text-xs text-blue-600" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Attached Files ({activeTicket.attachments.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Click to preview or download
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeTicket.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between gap-2 hover:border-blue-300 hover:shadow-xs transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-sm shrink-0">
                          {getFileIcon(att.extension, att.type)}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-semibold text-gray-900 truncate"
                            title={att.name}
                          >
                            {att.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                            <span className="uppercase font-mono font-bold text-gray-600">
                              {att.extension || "FILE"}
                            </span>
                            <span>•</span>
                            <span>{att.size || "Unknown size"}</span>
                            {att.uploadedBy && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[90px]">
                                  {att.uploadedBy}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(att)}
                          title="Preview attachment"
                          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        >
                          <FaEye className="text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(att)}
                          title="Download attachment"
                          className="p-1.5 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <FaDownload className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thread messages container */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 max-h-96 min-h-[160px] overflow-y-auto space-y-3">
              {loadingChat ? (
                <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                  Loading conversation thread...
                </div>
              ) : !activeTicket.messages || activeTicket.messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No conversation history available.
                </div>
              ) : (
                activeTicket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "admin" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-500">
                      <span className="font-bold text-gray-800 flex items-center gap-1">
                        {msg.role === "admin" ? (
                          <FaHeadset className="text-blue-600 text-[10px]" />
                        ) : (
                          <FaUser className="text-gray-400 text-[10px]" />
                        )}
                        {msg.sender}
                      </span>
                      <span>•</span>
                      <span>{msg.time}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm max-w-[85%] leading-relaxed ${
                        msg.role === "admin"
                          ? "bg-blue-600 text-white rounded-br-xs shadow-xs"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-xs shadow-xs"
                      }`}
                    >
                      <div>{msg.text}</div>

                      {/* Render message attachments if present */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 pt-2 border-t border-black/10">
                          {msg.attachments.map((att) => (
                            <div
                              key={att.id}
                              className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition ${
                                msg.role === "admin"
                                  ? "bg-blue-700/60 text-white border border-blue-500/40"
                                  : "bg-gray-50 text-gray-800 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm shrink-0">
                                  {getFileIcon(att.extension, att.type)}
                                </span>
                                <div className="min-w-0">
                                  <p
                                    className="font-semibold truncate max-w-[180px]"
                                    title={att.name}
                                  >
                                    {att.name}
                                  </p>
                                  <span
                                    className={`text-[10px] block ${
                                      msg.role === "admin"
                                        ? "text-blue-200"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {att.size || "Unknown"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPreview(att)}
                                  title="Preview"
                                  className={`p-1 rounded transition cursor-pointer ${
                                    msg.role === "admin"
                                      ? "hover:bg-blue-500 text-blue-100 hover:text-white"
                                      : "hover:bg-gray-200 text-gray-500 hover:text-blue-600"
                                  }`}
                                >
                                  <FaEye className="text-[11px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  title="Download"
                                  className={`p-1 rounded transition cursor-pointer ${
                                    msg.role === "admin"
                                      ? "hover:bg-blue-500 text-blue-100 hover:text-white"
                                      : "hover:bg-gray-200 text-gray-500 hover:text-emerald-600"
                                  }`}
                                >
                                  <FaDownload className="text-[11px]" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply Form */}
            <form onSubmit={handleSendReply} className="space-y-2">
              <textarea
                rows={3}
                required={pendingAttachments.length === 0}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder={
                  activeTicket.status === "Closed"
                    ? "Type your response to reopen and reply to customer..."
                    : "Type your response to the customer here..."
                }
                className="w-full border border-gray-300 rounded-xl p-3 text-xs sm:text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />

              {/* Pending Selected Attachments */}
              {pendingAttachments.length > 0 && (
                <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-blue-900 font-semibold px-1">
                    <span>Attached to Reply ({pendingAttachments.length})</span>
                    <button
                      type="button"
                      onClick={() => setPendingAttachments([])}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingAttachments.map((att, idx) => (
                      <div
                        key={att.id || idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs text-gray-800 shadow-2xs"
                      >
                        {getFileIcon(att.extension, att.type)}
                        <span
                          className="font-medium truncate max-w-[140px]"
                          title={att.name}
                        >
                          {att.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          ({att.size})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingAttachment(idx)}
                          className="ml-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove file"
                        >
                          <FaTimes className="text-[10px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment error message */}
              {attachmentError && (
                <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 flex items-center gap-1.5">
                  <FaTimesCircle className="shrink-0 text-rose-500" />
                  <span>{attachmentError}</span>
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.json,.doc,.docx"
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => fileInputRef.current?.click()}
                    icon={<FaPaperclip className="text-blue-600" />}
                  >
                    Attach Files
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleAddSampleProof}
                    icon={<FaPlus className="text-indigo-600 text-[10px]" />}
                    title="Add mock demo proof attachment"
                  >
                    + Add Demo Proof
                  </Button>

                  <span className="text-[11px] text-gray-400 hidden sm:inline">
                    Max 5MB (Images, PDF, Logs, Docs)
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={<FaPaperPlane />}
                  isLoading={isReplying}
                  disabled={
                    (!replyMessage.trim() && pendingAttachments.length === 0) ||
                    isReplying
                  }
                >
                  Send Reply
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* File Preview Modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900 truncate">
              {previewAttachment?.name}
            </span>
          </div>
        }
        subtitle={
          previewAttachment
            ? `${(previewAttachment.extension || "FILE").toUpperCase()} • ${
                previewAttachment.size || "Unknown Size"
              } • Uploaded by ${previewAttachment.uploadedBy || "User"}`
            : ""
        }
        size="lg"
        footer={
          <div className="w-full flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Uploaded on: {previewAttachment?.uploadedAt || "Recent"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<FaDownload />}
                onClick={() => handleDownloadAttachment(previewAttachment)}
              >
                Download File
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalOpen(false)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        }
      >
        {previewAttachment && (
          <div className="space-y-4">
            {["png", "jpg", "jpeg", "webp", "gif"].includes(
              (previewAttachment.extension || "").toLowerCase()
            ) ? (
              <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center min-h-[260px] max-h-[420px] overflow-hidden">
                {previewAttachment.url ? (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[380px] max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-center p-8 space-y-2 text-white/80">
                    <FaImage className="text-5xl mx-auto text-indigo-400 mb-2" />
                    <p className="font-bold text-sm">{previewAttachment.name}</p>
                    <p className="text-xs text-indigo-200">
                      High-resolution image preview simulated for{" "}
                      {previewAttachment.size}
                    </p>
                  </div>
                )}
              </div>
            ) : previewAttachment.extension === "pdf" ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
                  <FaFilePdf />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">
                    {previewAttachment.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Adobe Acrobat Portable Document Format (
                    {previewAttachment.size})
                  </p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg max-w-md mx-auto text-left text-xs text-gray-600 font-mono space-y-1">
                  <p className="font-bold text-gray-800 border-b pb-1">
                    PDF Document Properties:
                  </p>
                  <p>• Document: Verified Support Proof Record</p>
                  <p>• Pages: 2 Pages</p>
                  <p>• Encryption: Standard 128-bit SSL</p>
                  <p>• Security: Passed client verification scan</p>
                </div>
              </div>
            ) : previewAttachment.extension === "json" ? (
              <div className="bg-slate-950 rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto max-h-72">
                <pre>
                  {JSON.stringify(
                    {
                      status: 429,
                      error: "Too Many Requests",
                      message:
                        "API rate limit of 100 req/min exceeded on endpoint /api/v2/services",
                      ipAddress: "157.34.89.214",
                      burstTokensRemaining: 0,
                      recommendedWhitelist: true,
                      timestamp:
                        previewAttachment.uploadedAt || "2026-09-07 14:20:00",
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center text-xl mx-auto">
                  <FaFileAlt />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">
                  {previewAttachment.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {previewAttachment.extension?.toUpperCase()} Text Document •{" "}
                  {previewAttachment.size}
                </p>
              </div>
            )}

            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">
                  File Name
                </span>
                <span
                  className="font-bold text-gray-800 truncate block mt-0.5"
                  title={previewAttachment.name}
                >
                  {previewAttachment.name}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">
                  File Format
                </span>
                <span className="font-bold text-gray-800 uppercase block mt-0.5 font-mono">
                  {previewAttachment.extension || "FILE"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">
                  File Size
                </span>
                <span className="font-bold text-gray-800 block mt-0.5 font-mono">
                  {previewAttachment.size || "Unknown"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">
                  Uploader
                </span>
                <span className="font-bold text-gray-800 block mt-0.5 truncate">
                  {previewAttachment.uploadedBy || "Customer"}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

export default AdminTickets;

