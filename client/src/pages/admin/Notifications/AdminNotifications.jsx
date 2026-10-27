/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaBullhorn,
  FaPlus,
  FaTrash,
  FaEnvelope,
  FaWhatsapp,
  FaTelegram,
  FaBell,
  FaSync,
  FaEye,
  FaEdit,
  FaCheckCircle,
  FaClock,
  FaUsers,
  FaExclamationTriangle,
  FaWindowMaximize,
  FaBroadcastTower,
  FaUndo,
  FaToggleOn,
  FaToggleOff,
  FaSave,
  FaCogs,
  FaHistory,
  FaFileAlt,
  FaMobileAlt,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

// Helper: Channel badge styling & icon
function getChannelBadge(channel = "") {
  const c = channel.toLowerCase();
  if (c.includes("whatsapp")) {
    return {
      icon: <FaWhatsapp className="text-emerald-600" />,
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      label: "WhatsApp",
    };
  }
  if (c.includes("telegram")) {
    return {
      icon: <FaTelegram className="text-sky-500" />,
      badge: "bg-sky-50 text-sky-700 border-sky-200",
      label: "Telegram",
    };
  }
  if (c.includes("sms")) {
    return {
      icon: <FaMobileAlt className="text-indigo-600" />,
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      label: "SMS",
    };
  }
  if (c.includes("push")) {
    return {
      icon: <FaBell className="text-amber-600" />,
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      label: "Push",
    };
  }
  return {
    icon: <FaEnvelope className="text-purple-600" />,
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Email",
  };
}

// Helper: Format & Audience Badges
function getAudienceBadge(target) {
  const t = (target || "").toLowerCase();
  if (t.includes("all")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (t.includes("reseller")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (t.includes("api")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getFormatIcon(type) {
  const t = (type || "").toLowerCase();
  if (t === "banner") return <FaBullhorn className="text-blue-500" />;
  if (t === "popup") return <FaWindowMaximize className="text-purple-500" />;
  return <FaBroadcastTower className="text-amber-500" />;
}

function getFormatLabel(type) {
  const t = (type || "").toLowerCase();
  if (t === "banner") return "Header Banner";
  if (t === "popup") return "Modal Popup";
  return "Notice Stream";
}

function AdminNotifications() {
  const { addToast } = useToast();

  // Active Main Tab State: 'announcements' | 'templates' | 'settings' | 'history'
  const [activeTab, setActiveTab] = useState("announcements");

  // -------------------------------------------------------------
  // 1. ANNOUNCEMENTS STATE
  // -------------------------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    target: "All Users",
    type: "banner",
    status: "Active",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedNotif, setSelectedNotif] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });

  // -------------------------------------------------------------
  // 2. NOTIFICATION TEMPLATES STATE
  // -------------------------------------------------------------
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateChannelFilter, setTemplateChannelFilter] = useState("all");
  const [templateStatusFilter, setTemplateStatusFilter] = useState("all");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState("create");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    event: "order_created",
    eventLabel: "Order Created",
    channel: "Email",
    subject: "",
    body: "",
    status: "Active",
    variables: ["{user_name}", "{order_id}", "{service_name}", "{amount}", "{balance}"],
  });
  const [templateErrors, setTemplateErrors] = useState({});
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [templateStatusLoadingId, setTemplateStatusLoadingId] = useState(null);

  // -------------------------------------------------------------
  // 3. NOTIFICATION SETTINGS STATE
  // -------------------------------------------------------------
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // -------------------------------------------------------------
  // 4. NOTIFICATION HISTORY / SENT LOGS STATE
  // -------------------------------------------------------------
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannelFilter, setHistoryChannelFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  const [selectedLog, setSelectedLog] = useState(null);
  const [logDetailsOpen, setLogDetailsOpen] = useState(false);

  // -------------------------------------------------------------
  // DATA FETCHING HANDLERS
  // -------------------------------------------------------------
  const fetchNotifications = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const data = await adminService.getNotifications();
        setNotifications(Array.isArray(data) ? data : []);

        if (isManualRefresh) {
          addToast("Announcements and notifications refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
        setFetchError("Failed to load announcements. Please check your connection.");
        addToast("Failed to load notifications", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await adminService.getNotificationTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      addToast("Failed to load notification templates", "error");
    } finally {
      setTemplatesLoading(false);
    }
  }, [addToast]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await adminService.getNotificationSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load notification settings:", err);
      addToast("Failed to load notification channel settings", "error");
    } finally {
      setSettingsLoading(false);
    }
  }, [addToast]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await adminService.getNotificationHistory();
      setHistoryLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load notification history:", err);
      addToast("Failed to load notification delivery logs", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (activeTab === "templates" && templates.length === 0) {
      fetchTemplates();
    } else if (activeTab === "settings" && !settings) {
      fetchSettings();
    } else if (activeTab === "history" && historyLogs.length === 0) {
      fetchHistory();
    }
  }, [activeTab, templates.length, settings, historyLogs.length, fetchTemplates, fetchSettings, fetchHistory]);

  // -------------------------------------------------------------
  // ANNOUNCEMENTS LOGIC & DERIVED METRICS
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = notifications.length;
    const activeCount = notifications.filter(
      (n) => (n.status || "").toLowerCase() === "active"
    ).length;
    const inactiveCount = total - activeCount;

    const bannerCount = notifications.filter(
      (n) => (n.type || "").toLowerCase() === "banner"
    ).length;
    const popupCount = notifications.filter(
      (n) => (n.type || "").toLowerCase() === "popup"
    ).length;
    const broadcastCount = notifications.filter(
      (n) => (n.type || "").toLowerCase() === "broadcast"
    ).length;

    return {
      total,
      activeCount,
      inactiveCount,
      bannerCount,
      popupCount,
      broadcastCount,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesSearch =
        !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.message && item.message.toLowerCase().includes(q)) ||
        (item.target && item.target.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase().includes(q)) ||
        (item.type && item.type.toLowerCase().includes(q));

      const matchesAudience =
        audienceFilter === "all" ||
        (item.target && item.target.toLowerCase() === audienceFilter.toLowerCase());

      const matchesFormat =
        formatFilter === "all" ||
        (item.type && item.type.toLowerCase() === formatFilter.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (item.status && item.status.toLowerCase() === statusFilter.toLowerCase());

      return matchesSearch && matchesAudience && matchesFormat && matchesStatus;
    });
  }, [notifications, search, audienceFilter, formatFilter, statusFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    audienceFilter !== "all" ||
    formatFilter !== "all" ||
    statusFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setAudienceFilter("all");
    setFormatFilter("all");
    setStatusFilter("all");
  };

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingId(null);
    setFormData({
      title: "",
      message: "",
      target: "All Users",
      type: "banner",
      status: "Active",
    });
    setFormErrors({});
    setFormModalOpen(true);
  };

  const handleOpenEdit = (notif) => {
    setModalMode("edit");
    setEditingId(notif.id);
    setFormData({
      title: notif.title || "",
      message: notif.message || "",
      target: notif.target || "All Users",
      type: notif.type || "banner",
      status: notif.status || "Active",
    });
    setFormErrors({});
    if (detailsModalOpen) setDetailsModalOpen(false);
    setFormModalOpen(true);
  };

  const handleOpenDetails = (notif) => {
    setSelectedNotif(notif);
    setDetailsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    const trimmedTitle = formData.title.trim();
    const trimmedMessage = formData.message.trim();

    if (!trimmedTitle) {
      errors.title = "Announcement title is required";
    } else if (trimmedTitle.length < 3) {
      errors.title = "Title must be at least 3 characters";
    } else if (trimmedTitle.length > 120) {
      errors.title = "Title cannot exceed 120 characters";
    }

    if (!trimmedMessage) {
      errors.message = "Message content is required";
    } else if (trimmedMessage.length < 10) {
      errors.message = "Message content must be at least 10 characters";
    } else if (trimmedMessage.length > 1000) {
      errors.message = "Message content cannot exceed 1000 characters";
    }

    if (!formData.target) {
      errors.target = "Target audience selection is required";
    }
    if (!formData.type) {
      errors.type = "Display format selection is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      addToast("Please resolve validation errors before publishing", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        target: formData.target,
        type: formData.type,
        status: formData.status,
      };

      if (modalMode === "create") {
        const created = await adminService.createNotification(payload);
        setNotifications((prev) => [created, ...prev]);
        addToast("New announcement broadcasted successfully", "success");
      } else {
        const updated = await adminService.updateNotification(editingId, payload);
        setNotifications((prev) =>
          prev.map((n) => (n.id === editingId ? { ...n, ...updated } : n))
        );
        if (selectedNotif && selectedNotif.id === editingId) {
          setSelectedNotif((prev) => ({ ...prev, ...updated }));
        }
        addToast("Announcement updated successfully", "success");
      }

      setFormModalOpen(false);
    } catch (err) {
      console.error("Failed to save announcement:", err);
      addToast(`Failed to ${modalMode === "create" ? "create" : "update"} announcement`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (notif) => {
    const nextStatus = notif.status === "Active" ? "Inactive" : "Active";
    setStatusLoadingId(notif.id);

    try {
      if (adminService.updateNotificationStatus) {
        await adminService.updateNotificationStatus(notif.id, nextStatus);
      } else {
        await adminService.updateNotification(notif.id, { status: nextStatus });
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, status: nextStatus } : n))
      );

      if (selectedNotif && selectedNotif.id === notif.id) {
        setSelectedNotif((prev) => ({ ...prev, status: nextStatus }));
      }

      addToast(
        `Announcement #${notif.id} is now ${nextStatus.toLowerCase()}`,
        nextStatus === "Active" ? "success" : "info"
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      addToast("Failed to change announcement status", "error");
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleDeleteClick = (notif) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Announcement #${notif.id}?`,
      message: `Are you sure you want to permanently delete "${notif.title}"? This announcement will be removed from all customer panels immediately.`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await adminService.deleteNotification(notif.id);
          setNotifications((prev) => prev.filter((n) => n.id !== notif.id));

          if (selectedNotif && selectedNotif.id === notif.id) {
            setDetailsModalOpen(false);
            setSelectedNotif(null);
          }

          addToast(`Announcement #${notif.id} deleted successfully`, "success");
        } catch (err) {
          console.error("Failed to delete notification:", err);
          addToast("Failed to delete announcement", "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  // -------------------------------------------------------------
  // TEMPLATES LOGIC
  // -------------------------------------------------------------
  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((tpl) => {
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q) ||
        tpl.body.toLowerCase().includes(q) ||
        tpl.eventLabel.toLowerCase().includes(q);

      const matchesChannel =
        templateChannelFilter === "all" ||
        tpl.channel.toLowerCase() === templateChannelFilter.toLowerCase();

      const matchesStatus =
        templateStatusFilter === "all" ||
        tpl.status.toLowerCase() === templateStatusFilter.toLowerCase();

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [templates, templateSearch, templateChannelFilter, templateStatusFilter]);

  const handleOpenCreateTemplate = () => {
    setTemplateModalMode("create");
    setEditingTemplateId(null);
    setTemplateForm({
      name: "",
      event: "order_created",
      eventLabel: "Order Created",
      channel: "Email",
      subject: "",
      body: "",
      status: "Active",
      variables: ["{user_name}", "{order_id}", "{service_name}", "{amount}", "{balance}"],
    });
    setTemplateErrors({});
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl) => {
    setTemplateModalMode("edit");
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      name: tpl.name || "",
      event: tpl.event || "order_created",
      eventLabel: tpl.eventLabel || "Order Created",
      channel: tpl.channel || "Email",
      subject: tpl.subject || "",
      body: tpl.body || "",
      status: tpl.status || "Active",
      variables: Array.isArray(tpl.variables) ? tpl.variables : ["{user_name}"],
    });
    setTemplateErrors({});
    if (templateDetailsOpen) setTemplateDetailsOpen(false);
    setTemplateModalOpen(true);
  };

  const handleOpenTemplateDetails = (tpl) => {
    setSelectedTemplate(tpl);
    setTemplateDetailsOpen(true);
  };

  const handleToggleTemplateStatus = async (tpl) => {
    setTemplateStatusLoadingId(tpl.id);
    try {
      const res = await adminService.toggleNotificationTemplateStatus(tpl.id);
      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === tpl.id ? { ...t, status: res.status } : t))
        );
        if (selectedTemplate && selectedTemplate.id === tpl.id) {
          setSelectedTemplate((prev) => ({ ...prev, status: res.status }));
        }
        addToast(
          `Template "${tpl.name}" is now ${res.status.toLowerCase()}`,
          res.status === "Active" ? "success" : "info"
        );
      }
    } catch (err) {
      console.error("Failed to toggle template status:", err);
      addToast("Failed to update template status", "error");
    } finally {
      setTemplateStatusLoadingId(null);
    }
  };

  const insertVariableIntoTemplateBody = (variableTag) => {
    setTemplateForm((prev) => ({
      ...prev,
      body: prev.body + " " + variableTag,
    }));
  };

  const handleTemplateFormSubmit = async (e) => {
    if (e) e.preventDefault();

    const errors = {};
    if (!templateForm.name.trim()) errors.name = "Template name is required";
    if (!templateForm.subject.trim()) errors.subject = "Subject or title is required";
    if (!templateForm.body.trim()) errors.body = "Message body content is required";

    if (Object.keys(errors).length > 0) {
      setTemplateErrors(errors);
      addToast("Please fill all required template fields", "error");
      return;
    }

    setIsTemplateSubmitting(true);
    try {
      if (templateModalMode === "create") {
        const created = await adminService.createNotificationTemplate(templateForm);
        setTemplates((prev) => [created, ...prev]);
        addToast("New notification template created", "success");
      } else {
        const updated = await adminService.updateNotificationTemplate(
          editingTemplateId,
          templateForm
        );
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplateId ? { ...t, ...updated } : t))
        );
        if (selectedTemplate && selectedTemplate.id === editingTemplateId) {
          setSelectedTemplate((prev) => ({ ...prev, ...updated }));
        }
        addToast("Notification template updated successfully", "success");
      }
      setTemplateModalOpen(false);
    } catch (err) {
      console.error("Failed to save template:", err);
      addToast("Failed to save template", "error");
    } finally {
      setIsTemplateSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // SETTINGS LOGIC
  // -------------------------------------------------------------
  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const updated = await adminService.updateNotificationSettings(settings);
      setSettings(updated);
      addToast("Notification channel configurations saved successfully", "success");
    } catch (err) {
      console.error("Failed to save notification settings:", err);
      addToast("Failed to save settings", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // -------------------------------------------------------------
  // HISTORY / LOGS LOGIC
  // -------------------------------------------------------------
  const filteredHistoryLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return historyLogs.filter((log) => {
      const matchesSearch =
        !q ||
        log.recipient.toLowerCase().includes(q) ||
        log.recipientContact.toLowerCase().includes(q) ||
        log.subject.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q);

      const matchesChannel =
        historyChannelFilter === "all" ||
        log.channel.toLowerCase() === historyChannelFilter.toLowerCase();

      const matchesStatus =
        historyStatusFilter === "all" ||
        log.status.toLowerCase() === historyStatusFilter.toLowerCase();

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [historyLogs, historySearch, historyChannelFilter, historyStatusFilter]);

  // -------------------------------------------------------------
  // TABLE COLUMNS FOR ANNOUNCEMENTS
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Announcement & Content",
      accessor: "title",
      render: (row) => (
        <div className="max-w-md py-0.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
              {row.id}
            </span>
            <button
              onClick={() => handleOpenDetails(row)}
              className="font-bold text-sm text-gray-900 hover:text-blue-600 transition-colors text-left line-clamp-1 cursor-pointer"
              title="Click to view details"
            >
              {row.title}
            </button>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {row.message}
          </p>
        </div>
      ),
    },
    {
      header: "Audience",
      accessor: "target",
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${getAudienceBadge(
            row.target
          )}`}
        >
          <FaUsers className="text-[10px]" />
          {row.target || "All Users"}
        </span>
      ),
    },
    {
      header: "Format",
      accessor: "type",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
          {getFormatIcon(row.type)}
          <span>{getFormatLabel(row.type)}</span>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge status={row.status} size="xs" />
          <button
            onClick={() => handleToggleStatus(row)}
            disabled={statusLoadingId === row.id}
            className="text-gray-400 hover:text-blue-600 transition disabled:opacity-50 cursor-pointer"
            title={row.status === "Active" ? "Click to Deactivate" : "Click to Activate"}
          >
            {statusLoadingId === row.id ? (
              <FaSync className="animate-spin text-xs text-blue-600" />
            ) : row.status === "Active" ? (
              <FaToggleOn className="text-lg text-emerald-600 hover:text-emerald-700" />
            ) : (
              <FaToggleOff className="text-lg text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>
      ),
    },
    {
      header: "Created",
      accessor: "createdAt",
      render: (row) => (
        <div className="text-xs text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
          <FaClock className="text-[10px] text-gray-400 shrink-0" />
          <span>{row.createdAt || "N/A"}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleOpenDetails(row)}
            icon={<FaEye className="text-xs" />}
            title="View Details"
          />
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleOpenEdit(row)}
            icon={<FaEdit className="text-xs text-blue-600" />}
            title="Edit Announcement"
          />
          <Button
            size="xs"
            variant="danger"
            onClick={() => handleDeleteClick(row)}
            icon={<FaTrash className="text-xs" />}
            title="Delete Announcement"
          />
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* ------------------------------------------------------------- */}
      {/* Top Header */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <FaBullhorn className="text-lg" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Announcements & Notifications
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Broadcast customer banners, automated event templates, multi-channel gateways, and delivery logs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "announcements" && (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<FaSync className={refreshing ? "animate-spin" : ""} />}
                onClick={() => fetchNotifications(true)}
                disabled={loading || refreshing}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FaPlus />}
                onClick={handleOpenCreate}
              >
                Create Announcement
              </Button>
            </>
          )}

          {activeTab === "templates" && (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<FaSync className={templatesLoading ? "animate-spin" : ""} />}
                onClick={fetchTemplates}
                disabled={templatesLoading}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FaPlus />}
                onClick={handleOpenCreateTemplate}
              >
                New Template
              </Button>
            </>
          )}

          {activeTab === "settings" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaSave />}
              onClick={handleSaveSettings}
              isLoading={isSavingSettings}
            >
              Save All Settings
            </Button>
          )}

          {activeTab === "history" && (
            <Button
              variant="outline"
              size="sm"
              icon={<FaSync className={historyLoading ? "animate-spin" : ""} />}
              onClick={fetchHistory}
              disabled={historyLoading}
            >
              Refresh Logs
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Tab Navigation Controls */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-gray-200 mb-6 gap-2 sm:gap-4 overflow-x-auto text-xs sm:text-sm font-bold">
        {[
          { id: "announcements", label: "Announcements & Banners", icon: <FaBullhorn /> },
          { id: "templates", label: "Notification Templates", icon: <FaFileAlt /> },
          { id: "settings", label: "Channel Settings", icon: <FaCogs /> },
          { id: "history", label: "Delivery History / Logs", icon: <FaHistory /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-600 font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* TAB 1: ANNOUNCEMENTS & BANNERS */}
      {/* ============================================================= */}
      {activeTab === "announcements" && (
        <>
          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2"
                  >
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                ))}
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>
          ) : fetchError ? (
            /* Error State */
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3 my-6">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
                <FaExclamationTriangle />
              </div>
              <h3 className="text-base font-bold text-rose-900">Failed to Load Announcements</h3>
              <p className="text-xs text-rose-600 max-w-md mx-auto">{fetchError}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => fetchNotifications(false)}
                icon={<FaSync />}
              >
                Retry Loading
              </Button>
            </div>
          ) : (
            <>
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Announcements */}
                <div
                  onClick={() => {
                    setStatusFilter("all");
                    setAudienceFilter("all");
                    setFormatFilter("all");
                  }}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                      Total Announcements
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                      <FaBullhorn />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mt-2">{metrics.total}</h3>
                  <p className="text-[11px] text-gray-400 mt-1">Total published broadcasts</p>
                </div>

                {/* Active Alerts */}
                <div
                  onClick={() => setStatusFilter("Active")}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                      Active Announcements
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                      <FaCheckCircle />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <h3 className="text-2xl font-black text-emerald-600">
                      {metrics.activeCount}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    Visible on customer portal
                  </p>
                </div>

                {/* Header Banners */}
                <div
                  onClick={() => setFormatFilter("banner")}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-sky-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-sky-700 font-semibold uppercase tracking-wider">
                      Header Banners
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-sm">
                      <FaBell />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-sky-600 mt-2">
                    {metrics.bannerCount}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">Top-bar prominent banners</p>
                </div>

                {/* Modal Popups & Notices */}
                <div
                  onClick={() => setFormatFilter("popup")}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-purple-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-purple-700 font-semibold uppercase tracking-wider">
                      Popups & Streams
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                      <FaWindowMaximize />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-purple-600 mt-2">
                    {metrics.popupCount + metrics.broadcastCount}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {metrics.popupCount} Popups / {metrics.broadcastCount} Streams
                  </p>
                </div>
              </div>

              {/* Channels Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
                    <FaBell />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-gray-800 truncate">Banner Alerts</h4>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        Active
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      Top alert banner on panel
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
                    <FaWhatsapp />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-gray-800 truncate">WhatsApp Gateway</h4>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                        API Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      Automated order alerts
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg shrink-0">
                    <FaTelegram />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-gray-800 truncate">Telegram Bot</h4>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                        API Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      Channel broadcasts
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
                    <FaEnvelope />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-gray-800 truncate">SMTP Email</h4>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        Configured
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      Transactional dispatches
                    </p>
                  </div>
                </div>
              </div>

              {/* Announcements DataTable */}
              <DataTable
                columns={columns}
                data={filteredNotifications}
                isLoading={loading}
                searchable={true}
                searchPlaceholder="Search announcements by title, message, audience, or ID..."
                searchValue={search}
                onSearch={setSearch}
                emptyTitle="No Announcements Found"
                emptySubtitle="No announcements match your active search or filter criteria."
                filters={
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={audienceFilter}
                      onChange={(e) => setAudienceFilter(e.target.value)}
                      className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Audiences</option>
                      <option value="All Users">All Users</option>
                      <option value="Customers Only">Customers Only</option>
                      <option value="Resellers Only">Resellers Only</option>
                      <option value="API Clients Only">API Clients Only</option>
                    </select>

                    <select
                      value={formatFilter}
                      onChange={(e) => setFormatFilter(e.target.value)}
                      className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Formats</option>
                      <option value="banner">Header Banner</option>
                      <option value="popup">Modal Popup</option>
                      <option value="broadcast">Notice Stream</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Active">Active Only</option>
                      <option value="Inactive">Inactive Only</option>
                    </select>

                    {hasActiveFilters && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={handleResetFilters}
                        icon={<FaUndo className="text-[10px]" />}
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                }
              />
            </>
          )}
        </>
      )}

      {/* ============================================================= */}
      {/* TAB 2: NOTIFICATION TEMPLATES */}
      {/* ============================================================= */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Automated Notification Templates
              </h3>
              <p className="text-xs text-gray-500">
                Configure event-driven notification triggers across Email, SMS, WhatsApp, Telegram, and Push channels
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search templates by name, subject, or event..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              />

              <select
                value={templateChannelFilter}
                onChange={(e) => setTemplateChannelFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Channels</option>
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Telegram">Telegram</option>
                <option value="Push">Push</option>
              </select>

              <select
                value={templateStatusFilter}
                onChange={(e) => setTemplateStatusFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Templates Grid / Table */}
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <FaFileAlt className="text-3xl text-gray-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-gray-800">No Notification Templates Found</h4>
              <p className="text-xs text-gray-500 mt-1">No templates match the selected filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((tpl) => {
                const chan = getChannelBadge(tpl.channel);
                return (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Channel & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${chan.badge}`}
                          >
                            {chan.icon}
                            <span>{tpl.channel}</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-gray-400">
                            {tpl.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge status={tpl.status} size="xs" />
                          <button
                            onClick={() => handleToggleTemplateStatus(tpl)}
                            disabled={templateStatusLoadingId === tpl.id}
                            className="text-gray-400 hover:text-blue-600 transition cursor-pointer"
                            title={tpl.status === "Active" ? "Click to Deactivate" : "Click to Activate"}
                          >
                            {templateStatusLoadingId === tpl.id ? (
                              <FaSync className="animate-spin text-xs text-blue-600" />
                            ) : tpl.status === "Active" ? (
                              <FaToggleOn className="text-lg text-emerald-600 hover:text-emerald-700" />
                            ) : (
                              <FaToggleOff className="text-lg text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Template Name & Subject */}
                      <h4 className="font-bold text-sm text-gray-900 leading-snug">
                        {tpl.name}
                      </h4>
                      <p className="text-xs text-blue-600 font-medium mt-0.5 line-clamp-1">
                        Subject: {tpl.subject}
                      </p>

                      {/* Body Preview */}
                      <div className="mt-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700 font-mono leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {tpl.body}
                      </div>

                      {/* Variables list */}
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {tpl.variables?.map((v, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-4 text-xs">
                      <span className="text-[11px] text-gray-400">
                        Event: <strong className="text-gray-700">{tpl.eventLabel}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleOpenTemplateDetails(tpl)}
                          icon={<FaEye />}
                        >
                          View
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleOpenEditTemplate(tpl)}
                          icon={<FaEdit className="text-blue-600" />}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: NOTIFICATION CHANNEL SETTINGS */}
      {/* ============================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {settingsLoading || !settings ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Email (SMTP / SendGrid) */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600 text-lg">
                      <FaEnvelope />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Email Gateway (SMTP)</h3>
                      <p className="text-xs text-gray-500">Send transactional & order emails</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        email: { ...settings.email, enabled: !settings.email.enabled },
                      })
                    }
                    className="cursor-pointer text-xl"
                  >
                    {settings.email.enabled ? (
                      <FaToggleOn className="text-emerald-600 text-2xl" />
                    ) : (
                      <FaToggleOff className="text-gray-400 text-2xl" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Provider</label>
                    <select
                      value={settings.email.provider}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, provider: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Custom SMTP">Custom SMTP Server</option>
                      <option value="SendGrid">SendGrid API</option>
                      <option value="Amazon SES">Amazon SES</option>
                      <option value="Mailgun">Mailgun</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={settings.email.host}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, host: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Port</label>
                    <input
                      type="text"
                      value={settings.email.port}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, port: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Encryption</label>
                    <select
                      value={settings.email.encryption}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, encryption: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="TLS">TLS</option>
                      <option value="SSL">SSL</option>
                      <option value="None">None</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Sender Name</label>
                    <input
                      type="text"
                      value={settings.email.senderName}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, senderName: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Sender Email</label>
                    <input
                      type="email"
                      value={settings.email.senderEmail}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          email: { ...settings.email, senderEmail: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. WhatsApp Gateway */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 text-lg">
                      <FaWhatsapp />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">WhatsApp Business API</h3>
                      <p className="text-xs text-gray-500">Automated order & deposit messages</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        whatsapp: { ...settings.whatsapp, enabled: !settings.whatsapp.enabled },
                      })
                    }
                    className="cursor-pointer text-xl"
                  >
                    {settings.whatsapp.enabled ? (
                      <FaToggleOn className="text-emerald-600 text-2xl" />
                    ) : (
                      <FaToggleOff className="text-gray-400 text-2xl" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Provider</label>
                    <select
                      value={settings.whatsapp.provider}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsapp: { ...settings.whatsapp, provider: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      <option value="Meta Cloud API">Meta Cloud API (Official)</option>
                      <option value="Wati">Wati</option>
                      <option value="UltraMsg">UltraMsg Gateway</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Business Phone</label>
                    <input
                      type="text"
                      value={settings.whatsapp.businessPhone}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsapp: { ...settings.whatsapp, businessPhone: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Phone Number ID</label>
                    <input
                      type="text"
                      value={settings.whatsapp.phoneNumberId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsapp: { ...settings.whatsapp, phoneNumberId: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Access Token</label>
                    <input
                      type="password"
                      value={settings.whatsapp.accessTokenPlaceholder}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Telegram Bot */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-sky-50 text-sky-600 text-lg">
                      <FaTelegram />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Telegram Bot Channel</h3>
                      <p className="text-xs text-gray-500">Channel alerts & user DM notifications</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        telegram: { ...settings.telegram, enabled: !settings.telegram.enabled },
                      })
                    }
                    className="cursor-pointer text-xl"
                  >
                    {settings.telegram.enabled ? (
                      <FaToggleOn className="text-emerald-600 text-2xl" />
                    ) : (
                      <FaToggleOff className="text-gray-400 text-2xl" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Bot Username</label>
                    <input
                      type="text"
                      value={settings.telegram.botUsername}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram: { ...settings.telegram, botUsername: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Bot Token</label>
                    <input
                      type="password"
                      value={settings.telegram.botTokenPlaceholder}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-gray-50 text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Admin Alerts Channel</label>
                    <input
                      type="text"
                      value={settings.telegram.adminChannel}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram: { ...settings.telegram, adminChannel: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Refill Alerts Channel</label>
                    <input
                      type="text"
                      value={settings.telegram.refillChannel}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          telegram: { ...settings.telegram, refillChannel: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 4. SMS Gateway */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 text-lg">
                      <FaMobileAlt />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">SMS Gateway (OTP & Alerts)</h3>
                      <p className="text-xs text-gray-500">Fast2SMS / Twilio transactional route</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        sms: { ...settings.sms, enabled: !settings.sms.enabled },
                      })
                    }
                    className="cursor-pointer text-xl"
                  >
                    {settings.sms.enabled ? (
                      <FaToggleOn className="text-emerald-600 text-2xl" />
                    ) : (
                      <FaToggleOff className="text-gray-400 text-2xl" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Provider</label>
                    <select
                      value={settings.sms.provider}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sms: { ...settings.sms, provider: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      <option value="Fast2SMS">Fast2SMS (India)</option>
                      <option value="Twilio">Twilio</option>
                      <option value="MSG91">MSG91</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Sender ID / Header</label>
                    <input
                      type="text"
                      value={settings.sms.senderId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sms: { ...settings.sms, senderId: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">DLT Entity ID</label>
                    <input
                      type="text"
                      value={settings.sms.dltEntityId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sms: { ...settings.sms, dltEntityId: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">API Key</label>
                    <input
                      type="password"
                      value={settings.sms.apiKeyPlaceholder}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: DELIVERY HISTORY / LOGS */}
      {/* ============================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <DataTable
            columns={[
              {
                header: "Log ID & Time",
                accessor: "id",
                render: (row) => (
                  <div className="py-0.5">
                    <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {row.id}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                      <FaClock className="text-[9px]" />
                      <span>{row.sentAt}</span>
                    </div>
                  </div>
                ),
              },
              {
                header: "Recipient",
                accessor: "recipient",
                render: (row) => (
                  <div>
                    <div className="font-bold text-gray-900 text-xs">{row.recipient}</div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      {row.userId} • {row.recipientContact}
                    </div>
                  </div>
                ),
              },
              {
                header: "Channel",
                accessor: "channel",
                render: (row) => {
                  const chan = getChannelBadge(row.channel);
                  return (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${chan.badge}`}
                    >
                      {chan.icon}
                      <span>{row.channel}</span>
                    </span>
                  );
                },
              },
              {
                header: "Event & Subject",
                accessor: "subject",
                render: (row) => (
                  <div className="max-w-xs">
                    <div className="font-semibold text-xs text-gray-900 truncate">
                      {row.subject}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">
                      {row.message}
                    </div>
                  </div>
                ),
              },
              {
                header: "Status",
                accessor: "status",
                render: (row) => <Badge status={row.status} size="xs" />,
              },
              {
                header: "Actions",
                accessor: "actions",
                render: (row) => (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setSelectedLog(row);
                      setLogDetailsOpen(true);
                    }}
                    icon={<FaEye />}
                    title="View Delivery Payload"
                  >
                    View
                  </Button>
                ),
              },
            ]}
            data={filteredHistoryLogs}
            isLoading={historyLoading}
            searchable={true}
            searchPlaceholder="Search logs by recipient, subject, or log ID..."
            searchValue={historySearch}
            onSearch={setHistorySearch}
            emptyTitle="No Delivery Logs Found"
            emptySubtitle="No notifications match the filter criteria."
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={historyChannelFilter}
                  onChange={(e) => setHistoryChannelFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Channels</option>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telegram">Telegram</option>
                  <option value="Push">Push</option>
                </select>

                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Failed">Failed</option>
                  <option value="Queued">Queued</option>
                </select>
              </div>
            }
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Create / Edit Announcement */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => !isSubmitting && setFormModalOpen(false)}
        title={
          modalMode === "create"
            ? "Broadcast New Announcement"
            : `Edit Announcement — ${editingId}`
        }
        subtitle="Configure the message content, visibility parameters, and target audience format"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFormSubmit}
              isLoading={isSubmitting}
              icon={<FaCheckCircle />}
            >
              {modalMode === "create" ? "Publish Announcement" : "Save Changes"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Announcement Title <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">
                {formData.title.length}/120
              </span>
            </div>
            <Input
              required
              maxLength={120}
              placeholder="e.g. ⚡ Weekend 10% Extra Bonus on All UPI Deposits"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (formErrors.title) setFormErrors({ ...formErrors, title: null });
              }}
              error={formErrors.title}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Message Content <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">
                {formData.message.length}/1000
              </span>
            </div>
            <textarea
              rows={4}
              required
              maxLength={1000}
              placeholder="Enter comprehensive announcement content, terms, and guidelines..."
              value={formData.message}
              onChange={(e) => {
                setFormData({ ...formData, message: e.target.value });
                if (formErrors.message) setFormErrors({ ...formErrors, message: null });
              }}
              className={`w-full rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.message ? "border-rose-500" : "border-gray-300"
              }`}
            />
            {formErrors.message && (
              <p className="text-xs text-rose-500 mt-1">{formErrors.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Target Audience <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All Users">All Users</option>
                <option value="Customers Only">Customers Only</option>
                <option value="Resellers Only">Resellers Only</option>
                <option value="API Clients Only">API Clients Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Display Format <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="banner">Header Banner</option>
                <option value="popup">Modal Popup</option>
                <option value="broadcast">Notice Stream</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">Active (Published)</option>
                <option value="Inactive">Inactive (Draft)</option>
              </select>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-600 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <FaEye className="text-blue-500" />
                Live Customer Portal Preview
              </span>
              <span className="text-[11px] font-normal text-gray-400">
                {getFormatLabel(formData.type)} · {formData.target}
              </span>
            </div>

            <div
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                formData.type === "banner"
                  ? "bg-blue-50/80 border-blue-200 text-blue-900"
                  : formData.type === "popup"
                  ? "bg-purple-50/80 border-purple-200 text-purple-900"
                  : "bg-amber-50/80 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {getFormatIcon(formData.type)}
                <span>{formData.title || "Announcement Title Preview"}</span>
              </div>
              <p className="text-[11px] opacity-90">
                {formData.message || "Message body will appear here to the customer..."}
              </p>
            </div>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Announcement Details */}
      {/* ------------------------------------------------------------- */}
      {selectedNotif && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={`Announcement Details — ${selectedNotif.id}`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={selectedNotif.status === "Active" ? "outline" : "success"}
                  onClick={() => handleToggleStatus(selectedNotif)}
                  disabled={statusLoadingId === selectedNotif.id}
                  icon={
                    statusLoadingId === selectedNotif.id ? (
                      <FaSync className="animate-spin" />
                    ) : (
                      <FaCheckCircle />
                    )
                  }
                >
                  {selectedNotif.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenEdit(selectedNotif)}
                  icon={<FaEdit />}
                >
                  Edit Announcement
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close Window
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedNotif.id}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getAudienceBadge(
                    selectedNotif.target
                  )}`}
                >
                  {selectedNotif.target}
                </span>
              </div>
              <Badge status={selectedNotif.status} size="sm" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
              <h3 className="font-bold text-base text-gray-900 leading-snug">
                {selectedNotif.title}
              </h3>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selectedNotif.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">
                  Display Channel & Format
                </span>
                <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
                  {getFormatIcon(selectedNotif.type)}
                  <span>{getFormatLabel(selectedNotif.type)}</span>
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">
                  Created Timestamp
                </span>
                <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
                  <FaClock className="text-gray-400" />
                  <span>{selectedNotif.createdAt || "N/A"}</span>
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Create / Edit Template */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => !isTemplateSubmitting && setTemplateModalOpen(false)}
        title={
          templateModalMode === "create"
            ? "Create Notification Template"
            : `Edit Template — ${editingTemplateId}`
        }
        subtitle="Configure event trigger, channel, subject, and dynamic replacement tags"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateModalOpen(false)}
              disabled={isTemplateSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTemplateFormSubmit}
              isLoading={isTemplateSubmitting}
              icon={<FaCheckCircle />}
            >
              {templateModalMode === "create" ? "Save Template" : "Update Template"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleTemplateFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Template Name <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Order Completed Notification"
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, name: e.target.value })
                }
                error={templateErrors.name}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Trigger Event <span className="text-rose-500">*</span>
              </label>
              <select
                value={templateForm.event}
                onChange={(e) => {
                  const eventMap = {
                    order_created: "Order Created",
                    order_completed: "Order Completed",
                    order_cancelled: "Order Cancelled / Refunded",
                    payment_received: "Deposit Received",
                    low_balance: "Low Balance Alert",
                    ticket_replied: "Ticket Replied",
                    user_welcome: "Account Welcome",
                    password_reset: "Password Reset OTP",
                  };
                  setTemplateForm({
                    ...templateForm,
                    event: e.target.value,
                    eventLabel: eventMap[e.target.value] || e.target.value,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 p-2 text-sm bg-white"
              >
                <option value="order_created">Order Created</option>
                <option value="order_completed">Order Completed</option>
                <option value="order_cancelled">Order Cancelled / Refunded</option>
                <option value="payment_received">Deposit Received</option>
                <option value="low_balance">Low Balance Alert</option>
                <option value="ticket_replied">Ticket Replied</option>
                <option value="user_welcome">Account Welcome</option>
                <option value="password_reset">Password Reset OTP</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={templateForm.channel}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, channel: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 p-2 text-sm bg-white"
              >
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Telegram">Telegram</option>
                <option value="Push">Push Notification</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Subject / Header Line <span className="text-rose-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Your Order #{order_id} has been received"
              value={templateForm.subject}
              onChange={(e) =>
                setTemplateForm({ ...templateForm, subject: e.target.value })
              }
              error={templateErrors.subject}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Message Body <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">Click tags below to insert</span>
            </div>
            <textarea
              rows={5}
              required
              placeholder="Write notification body with placeholders..."
              value={templateForm.body}
              onChange={(e) =>
                setTemplateForm({ ...templateForm, body: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
            {templateErrors.body && (
              <p className="text-xs text-rose-500 mt-1">{templateErrors.body}</p>
            )}

            {/* Variable Tag Chips */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-500 mr-1">Insert Tag:</span>
              {[
                "{user_name}",
                "{order_id}",
                "{service_name}",
                "{quantity}",
                "{amount}",
                "{balance}",
                "{link}",
                "{ticket_id}",
                "{otp_code}",
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertVariableIntoTemplateBody(tag)}
                  className="text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-700 px-2 py-1 rounded border border-gray-200 transition-colors cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Template Details */}
      {/* ------------------------------------------------------------- */}
      {selectedTemplate && (
        <Modal
          isOpen={templateDetailsOpen}
          onClose={() => setTemplateDetailsOpen(false)}
          title={`Template Details — ${selectedTemplate.name}`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleOpenEditTemplate(selectedTemplate)}
                icon={<FaEdit />}
              >
                Edit Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateDetailsOpen(false)}
              >
                Close Window
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    getChannelBadge(selectedTemplate.channel).badge
                  }`}
                >
                  {getChannelBadge(selectedTemplate.channel).icon}
                  <span>{selectedTemplate.channel}</span>
                </span>
                <span className="text-xs font-bold text-gray-700">
                  Event: {selectedTemplate.eventLabel}
                </span>
              </div>
              <Badge status={selectedTemplate.status} size="sm" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Subject / Title
              </span>
              <h4 className="text-sm font-bold text-gray-900">{selectedTemplate.subject}</h4>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Raw Template Content
              </span>
              <p className="text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                {selectedTemplate.body}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: View Log Delivery Details */}
      {/* ------------------------------------------------------------- */}
      {selectedLog && (
        <Modal
          isOpen={logDetailsOpen}
          onClose={() => setLogDetailsOpen(false)}
          title={`Delivery Log — ${selectedLog.id}`}
          size="md"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogDetailsOpen(false)}
            >
              Close Window
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    getChannelBadge(selectedLog.channel).badge
                  }`}
                >
                  {getChannelBadge(selectedLog.channel).icon}
                  <span>{selectedLog.channel}</span>
                </span>
                <span className="text-xs font-mono font-bold text-gray-500">
                  {selectedLog.sentAt}
                </span>
              </div>
              <Badge status={selectedLog.status} size="sm" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1 text-xs">
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Recipient Target
              </span>
              <div className="font-bold text-gray-900">{selectedLog.recipient}</div>
              <div className="text-gray-500 font-mono">
                User: {selectedLog.userId} | Destination: {selectedLog.recipientContact}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Delivered Message Body
              </span>
              <div className="font-bold text-gray-900 text-sm">{selectedLog.subject}</div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selectedLog.message}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Gateway Reference
              </span>
              <div className="font-mono text-gray-700">{selectedLog.gatewayRef}</div>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Confirmation Dialog */}
      {/* ------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          !confirmDialog.isLoading &&
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="danger"
        confirmText="Delete Announcement"
        isLoading={confirmDialog.isLoading}
      />
    </AdminLayout>
  );
}

export default AdminNotifications;
