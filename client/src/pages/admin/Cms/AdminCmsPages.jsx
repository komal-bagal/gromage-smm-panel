/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaEdit,
  FaSave,
  FaEye,
  FaFileAlt,
  FaSync,
  FaCheckCircle,
  FaClock,
  FaGlobe,
  FaLock,
  FaCopy,
  FaSearch,
  FaPlus,
  FaTrash,
  FaHome,
  FaQuestionCircle,
  FaNewspaper,
  FaImage,
  FaCode,
  FaShareAlt,
  FaToggleOn,
  FaToggleOff,
  FaLink,
  FaInstagram,
  FaYoutube,
  FaTelegram,
  FaTwitter,
  FaShieldAlt,
  FaCreditCard,
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

// Helper: safe rendering of CMS markdown/plain text without dangerous HTML injection
function SafeContentRenderer({ content }) {
  if (!content) {
    return <p className="text-gray-400 italic text-sm">No page content provided.</p>;
  }

  const paragraphs = content.split("\n\n");

  return (
    <div className="space-y-3 text-gray-800 text-sm leading-relaxed font-sans">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        return (
          <p key={pIdx} className="whitespace-pre-wrap">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {line}
                {lIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function AdminCmsPages() {
  const { addToast } = useToast();

  // Active Tab State: 'pages' | 'homepage' | 'faqs' | 'blogs' | 'banners' | 'footer' | 'scripts'
  const [activeTab, setActiveTab] = useState("pages");

  // -------------------------------------------------------------
  // 1. DYNAMIC CMS PAGES STATE
  // -------------------------------------------------------------
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [_error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePage, setActivePage] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    status: "Published",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // -------------------------------------------------------------
  // 2. HOMEPAGE CONTENT STATE
  // -------------------------------------------------------------
  const [homepageCms, setHomepageCms] = useState(null);
  const [homepageLoading, setHomepageLoading] = useState(false);
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);

  // -------------------------------------------------------------
  // 3. FAQS STATE
  // -------------------------------------------------------------
  const [faqs, setFaqs] = useState([]);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategoryFilter, setFaqCategoryFilter] = useState("all");
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqModalMode, setFaqModalMode] = useState("create");
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqForm, setFaqForm] = useState({
    category: "Orders",
    question: "",
    answer: "",
    order: 1,
    status: "Published",
  });
  const [faqErrors, setFaqErrors] = useState({});
  const [isFaqSubmitting, setIsFaqSubmitting] = useState(false);

  // -------------------------------------------------------------
  // 4. BLOGS STATE
  // -------------------------------------------------------------
  const [blogs, setBlogs] = useState([]);
  const [blogsLoading, setBlogsLoading] = useState(false);
  const [blogSearch, setBlogSearch] = useState("");
  const [blogModalOpen, setBlogModalOpen] = useState(false);
  const [blogModalMode, setBlogModalMode] = useState("create");
  const [editingBlogId, setEditingBlogId] = useState(null);
  const [blogForm, setBlogForm] = useState({
    title: "",
    slug: "",
    category: "General",
    excerpt: "",
    content: "",
    author: "Gromage Team",
    featuredImage: "",
    status: "Published",
  });
  const [blogErrors, setBlogErrors] = useState({});
  const [isBlogSubmitting, setIsBlogSubmitting] = useState(false);

  // -------------------------------------------------------------
  // 5. BANNERS STATE
  // -------------------------------------------------------------
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerModalMode, setBannerModalMode] = useState("create");
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerForm, setBannerForm] = useState({
    title: "",
    placement: "Top Header Banner",
    imageUrl: "",
    targetUrl: "/services",
    status: "Active",
  });
  const [bannerErrors, setBannerErrors] = useState({});
  const [isBannerSubmitting, setIsBannerSubmitting] = useState(false);

  // -------------------------------------------------------------
  // 6. FOOTER SETTINGS STATE
  // -------------------------------------------------------------
  const [footerCms, setFooterCms] = useState(null);
  const [footerLoading, setFooterLoading] = useState(false);
  const [isSavingFooter, setIsSavingFooter] = useState(false);

  // -------------------------------------------------------------
  // 7. CUSTOM SCRIPTS STATE
  // -------------------------------------------------------------
  const [customScripts, setCustomScripts] = useState(null);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [isSavingScripts, setIsSavingScripts] = useState(false);

  // Delete Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isLoading: false,
  });

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchPages = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (pages.length === 0) setLoading(true);
      setError(null);

      try {
        const data = await adminService.getCmsPages();
        setPages(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("CMS pages refreshed successfully", "success");
        }
      } catch (err) {
        const errMsg = err?.message || "Failed to load CMS pages";
        setError(errMsg);
        addToast(errMsg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pages.length, addToast]
  );

  const fetchHomepage = useCallback(async () => {
    setHomepageLoading(true);
    try {
      const data = await adminService.getHomepageCms();
      setHomepageCms(data);
    } catch (err) {
      console.error("Failed to load homepage CMS:", err);
      addToast("Failed to load homepage CMS", "error");
    } finally {
      setHomepageLoading(false);
    }
  }, [addToast]);

  const fetchFaqs = useCallback(async () => {
    setFaqsLoading(true);
    try {
      const data = await adminService.getFaqItems();
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load FAQs:", err);
      addToast("Failed to load FAQ items", "error");
    } finally {
      setFaqsLoading(false);
    }
  }, [addToast]);

  const fetchBlogs = useCallback(async () => {
    setBlogsLoading(true);
    try {
      const data = await adminService.getBlogPosts();
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load blogs:", err);
      addToast("Failed to load blog posts", "error");
    } finally {
      setBlogsLoading(false);
    }
  }, [addToast]);

  const fetchBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const data = await adminService.getBanners();
      setBanners(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load banners:", err);
      addToast("Failed to load promotional banners", "error");
    } finally {
      setBannersLoading(false);
    }
  }, [addToast]);

  const fetchFooter = useCallback(async () => {
    setFooterLoading(true);
    try {
      const data = await adminService.getFooterCms();
      setFooterCms(data);
    } catch (err) {
      console.error("Failed to load footer CMS:", err);
      addToast("Failed to load footer settings", "error");
    } finally {
      setFooterLoading(false);
    }
  }, [addToast]);

  const fetchScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const data = await adminService.getCustomScripts();
      setCustomScripts(data);
    } catch (err) {
      console.error("Failed to load custom scripts:", err);
      addToast("Failed to load custom scripts", "error");
    } finally {
      setScriptsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (activeTab === "homepage" && !homepageCms) fetchHomepage();
    else if (activeTab === "faqs" && faqs.length === 0) fetchFaqs();
    else if (activeTab === "blogs" && blogs.length === 0) fetchBlogs();
    else if (activeTab === "banners" && banners.length === 0) fetchBanners();
    else if (activeTab === "footer" && !footerCms) fetchFooter();
    else if (activeTab === "scripts" && !customScripts) fetchScripts();
  }, [activeTab, homepageCms, faqs.length, blogs.length, banners.length, footerCms, customScripts, fetchHomepage, fetchFaqs, fetchBlogs, fetchBanners, fetchFooter, fetchScripts]);

  // -------------------------------------------------------------
  // 1. DYNAMIC CMS PAGES LOGIC
  // -------------------------------------------------------------
  const summaryStats = useMemo(() => {
    const total = pages.length;
    const published = pages.filter((p) => p.status === "Published").length;
    const draft = pages.filter((p) => p.status === "Draft").length;

    const latestModified = pages.reduce((latest, p) => {
      const date = p.lastModified || p.updatedAt || "";
      return date > latest ? date : latest;
    }, "");

    return {
      total,
      published,
      draft,
      latestModified: latestModified || "Recently",
    };
  }, [pages]);

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      if (statusFilter !== "all" && page.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = page.title?.toLowerCase().includes(q);
        const matchSlug = page.slug?.toLowerCase().includes(q);
        const matchContent = page.content?.toLowerCase().includes(q);
        const matchId = page.id?.toLowerCase().includes(q);
        return matchTitle || matchSlug || matchContent || matchId;
      }

      return true;
    });
  }, [pages, statusFilter, searchQuery]);

  const isDirty = useMemo(() => {
    if (!activePage) return false;
    return (
      formData.title.trim() !== (activePage.title || "").trim() ||
      formData.content.trim() !== (activePage.content || "").trim() ||
      formData.status !== activePage.status
    );
  }, [activePage, formData]);

  const handleEdit = (page) => {
    setActivePage(page);
    setFormData({
      title: page.title || "",
      slug: page.slug || "",
      content: page.content || "",
      status: page.status || "Published",
    });
    setFormErrors({});
    setEditModalOpen(true);
  };

  const handleOpenCreatePage = () => {
    setFormData({
      title: "",
      slug: "",
      content: "",
      status: "Published",
    });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const handlePreview = (page) => {
    setActivePage(page);
    setPreviewModalOpen(true);
  };

  const handleCopySlug = (slug) => {
    const urlPath = `/${slug}`;
    navigator.clipboard.writeText(urlPath);
    setCopiedSlug(true);
    addToast(`Path '${urlPath}' copied to clipboard`, "info");
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = "Page title is required";
    } else if (formData.title.trim().length < 3) {
      errors.title = "Page title must be at least 3 characters";
    }

    if (!formData.content.trim()) {
      errors.content = "Page body content is required";
    } else if (formData.content.trim().length < 10) {
      errors.content = "Page content must be at least 10 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      addToast("Please correct the form validation errors", "error");
      return;
    }

    setIsSaving(true);
    try {
      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
      const updatedData = {
        title: formData.title.trim(),
        content: formData.content,
        status: formData.status,
      };

      await adminService.updateCmsPage(activePage.slug, updatedData);

      setPages((prev) =>
        prev.map((p) =>
          p.slug === activePage.slug
            ? {
                ...p,
                ...updatedData,
                lastModified: nowStr,
                updatedAt: nowStr.split(" ")[0],
              }
            : p
        )
      );

      addToast(`Page '${formData.title.trim()}' updated successfully`, "success");
      setEditModalOpen(false);
      setActivePage(null);
    } catch (err) {
      const errMsg = err?.message || "Failed to save CMS page";
      addToast(errMsg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const created = await adminService.createCmsPage(formData);
      setPages((prev) => [created, ...prev]);
      addToast(`Page '${created.title}' created successfully`, "success");
      setCreateModalOpen(false);
    } catch (err) {
      console.error("Failed to create page:", err);
      addToast("Failed to create page", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEdit = () => {
    if (isDirty) {
      if (
        window.confirm(
          "You have unsaved changes on this CMS page. Are you sure you want to discard them?"
        )
      ) {
        setEditModalOpen(false);
        setActivePage(null);
      }
    } else {
      setEditModalOpen(false);
      setActivePage(null);
    }
  };

  // -------------------------------------------------------------
  // 2. HOMEPAGE LOGIC
  // -------------------------------------------------------------
  const handleSaveHomepage = async () => {
    if (!homepageCms) return;
    setIsSavingHomepage(true);
    try {
      const updated = await adminService.updateHomepageCms(homepageCms);
      setHomepageCms(updated);
      addToast("Homepage content updated successfully", "success");
    } catch (err) {
      console.error("Failed to save homepage CMS:", err);
      addToast("Failed to update homepage content", "error");
    } finally {
      setIsSavingHomepage(false);
    }
  };

  // -------------------------------------------------------------
  // 3. FAQS LOGIC
  // -------------------------------------------------------------
  const filteredFaqs = useMemo(() => {
    return faqs.filter((f) => {
      const q = faqSearch.trim().toLowerCase();
      const matchQ = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      const matchCat = faqCategoryFilter === "all" || f.category.toLowerCase() === faqCategoryFilter.toLowerCase();
      return matchQ && matchCat;
    });
  }, [faqs, faqSearch, faqCategoryFilter]);

  const handleOpenCreateFaq = () => {
    setFaqModalMode("create");
    setEditingFaqId(null);
    setFaqForm({
      category: "Orders",
      question: "",
      answer: "",
      order: faqs.length + 1,
      status: "Published",
    });
    setFaqErrors({});
    setFaqModalOpen(true);
  };

  const handleOpenEditFaq = (faq) => {
    setFaqModalMode("edit");
    setEditingFaqId(faq.id);
    setFaqForm({
      category: faq.category || "General",
      question: faq.question || "",
      answer: faq.answer || "",
      order: faq.order || 1,
      status: faq.status || "Published",
    });
    setFaqErrors({});
    setFaqModalOpen(true);
  };

  const handleToggleFaqStatus = async (faq) => {
    try {
      const res = await adminService.toggleFaqItemStatus(faq.id);
      if (res.success) {
        setFaqs((prev) =>
          prev.map((f) => (f.id === faq.id ? { ...f, status: res.status } : f))
        );
        addToast(`FAQ status updated to ${res.status.toLowerCase()}`, "success");
      }
    } catch (err) {
      console.error("Failed to toggle FAQ:", err);
      addToast("Failed to update status", "error");
    }
  };

  const handleDeleteFaq = (faq) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete FAQ Item?`,
      message: `Are you sure you want to delete "${faq.question}"?`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await adminService.deleteFaqItem(faq.id);
          setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
          addToast("FAQ item deleted", "success");
        } catch (err) {
          console.error("Failed to delete FAQ:", err);
          addToast("Failed to delete FAQ", "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleFaqFormSubmit = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!faqForm.question.trim()) errors.question = "Question is required";
    if (!faqForm.answer.trim()) errors.answer = "Answer is required";

    if (Object.keys(errors).length > 0) {
      setFaqErrors(errors);
      return;
    }

    setIsFaqSubmitting(true);
    try {
      if (faqModalMode === "create") {
        const created = await adminService.createFaqItem(faqForm);
        setFaqs((prev) => [...prev, created]);
        addToast("New FAQ item created", "success");
      } else {
        const updated = await adminService.updateFaqItem(editingFaqId, faqForm);
        setFaqs((prev) =>
          prev.map((f) => (f.id === editingFaqId ? { ...f, ...updated } : f))
        );
        addToast("FAQ item updated successfully", "success");
      }
      setFaqModalOpen(false);
    } catch (err) {
      console.error("Failed to save FAQ:", err);
      addToast("Failed to save FAQ item", "error");
    } finally {
      setIsFaqSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 4. BLOGS LOGIC
  // -------------------------------------------------------------
  const filteredBlogs = useMemo(() => {
    const q = blogSearch.trim().toLowerCase();
    return blogs.filter((b) => !q || b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
  }, [blogs, blogSearch]);

  const handleOpenCreateBlog = () => {
    setBlogModalMode("create");
    setEditingBlogId(null);
    setBlogForm({
      title: "",
      slug: "",
      category: "General",
      excerpt: "",
      content: "",
      author: "Gromage Team",
      featuredImage: "",
      status: "Published",
    });
    setBlogErrors({});
    setBlogModalOpen(true);
  };

  const handleOpenEditBlog = (blog) => {
    setBlogModalMode("edit");
    setEditingBlogId(blog.id);
    setBlogForm({
      title: blog.title || "",
      slug: blog.slug || "",
      category: blog.category || "General",
      excerpt: blog.excerpt || "",
      content: blog.content || "",
      author: blog.author || "Gromage Team",
      featuredImage: blog.featuredImage || "",
      status: blog.status || "Published",
    });
    setBlogErrors({});
    setBlogModalOpen(true);
  };

  const handleToggleBlogStatus = async (blog) => {
    try {
      const res = await adminService.toggleBlogPostStatus(blog.id);
      if (res.success) {
        setBlogs((prev) =>
          prev.map((b) => (b.id === blog.id ? { ...b, status: res.status } : b))
        );
        addToast(`Blog status updated to ${res.status.toLowerCase()}`, "success");
      }
    } catch (err) {
      console.error("Failed to toggle blog status:", err);
      addToast("Failed to update status", "error");
    }
  };

  const handleDeleteBlog = (blog) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Blog Post?`,
      message: `Are you sure you want to delete "${blog.title}"?`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await adminService.deleteBlogPost(blog.id);
          setBlogs((prev) => prev.filter((b) => b.id !== blog.id));
          addToast("Blog post deleted", "success");
        } catch (err) {
          console.error("Failed to delete blog:", err);
          addToast("Failed to delete blog", "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleBlogFormSubmit = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!blogForm.title.trim()) errors.title = "Article title is required";
    if (!blogForm.content.trim()) errors.content = "Article content is required";

    if (Object.keys(errors).length > 0) {
      setBlogErrors(errors);
      return;
    }

    setIsBlogSubmitting(true);
    try {
      if (blogModalMode === "create") {
        const created = await adminService.createBlogPost(blogForm);
        setBlogs((prev) => [created, ...prev]);
        addToast("New blog post published", "success");
      } else {
        const updated = await adminService.updateBlogPost(editingBlogId, blogForm);
        setBlogs((prev) =>
          prev.map((b) => (b.id === editingBlogId ? { ...b, ...updated } : b))
        );
        addToast("Blog post updated successfully", "success");
      }
      setBlogModalOpen(false);
    } catch (err) {
      console.error("Failed to save blog:", err);
      addToast("Failed to save blog post", "error");
    } finally {
      setIsBlogSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 5. BANNERS LOGIC
  // -------------------------------------------------------------
  const handleOpenCreateBanner = () => {
    setBannerModalMode("create");
    setEditingBannerId(null);
    setBannerForm({
      title: "",
      placement: "Top Header Banner",
      imageUrl: "",
      targetUrl: "/services",
      status: "Active",
    });
    setBannerErrors({});
    setBannerModalOpen(true);
  };

  const handleOpenEditBanner = (banner) => {
    setBannerModalMode("edit");
    setEditingBannerId(banner.id);
    setBannerForm({
      title: banner.title || "",
      placement: banner.placement || "Top Header Banner",
      imageUrl: banner.imageUrl || "",
      targetUrl: banner.targetUrl || "/services",
      status: banner.status || "Active",
    });
    setBannerErrors({});
    setBannerModalOpen(true);
  };

  const handleToggleBannerStatus = async (banner) => {
    try {
      const res = await adminService.toggleBannerStatus(banner.id);
      if (res.success) {
        setBanners((prev) =>
          prev.map((b) => (b.id === banner.id ? { ...b, status: res.status } : b))
        );
        addToast(`Banner is now ${res.status.toLowerCase()}`, "success");
      }
    } catch (err) {
      console.error("Failed to toggle banner:", err);
      addToast("Failed to update banner status", "error");
    }
  };

  const handleDeleteBanner = (banner) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Banner?`,
      message: `Are you sure you want to delete "${banner.title}"?`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await adminService.deleteBanner(banner.id);
          setBanners((prev) => prev.filter((b) => b.id !== banner.id));
          addToast("Banner deleted", "success");
        } catch (err) {
          console.error("Failed to delete banner:", err);
          addToast("Failed to delete banner", "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleBannerFormSubmit = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!bannerForm.title.trim()) errors.title = "Banner title is required";
    if (!bannerForm.imageUrl.trim()) errors.imageUrl = "Banner image URL is required";

    if (Object.keys(errors).length > 0) {
      setBannerErrors(errors);
      return;
    }

    setIsBannerSubmitting(true);
    try {
      if (bannerModalMode === "create") {
        const created = await adminService.createBanner(bannerForm);
        setBanners((prev) => [created, ...prev]);
        addToast("New banner added", "success");
      } else {
        const updated = await adminService.updateBanner(editingBannerId, bannerForm);
        setBanners((prev) =>
          prev.map((b) => (b.id === editingBannerId ? { ...b, ...updated } : b))
        );
        addToast("Banner updated", "success");
      }
      setBannerModalOpen(false);
    } catch (err) {
      console.error("Failed to save banner:", err);
      addToast("Failed to save banner", "error");
    } finally {
      setIsBannerSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 6. FOOTER SETTINGS LOGIC
  // -------------------------------------------------------------
  const handleSaveFooter = async () => {
    if (!footerCms) return;
    setIsSavingFooter(true);
    try {
      const updated = await adminService.updateFooterCms(footerCms);
      setFooterCms(updated);
      addToast("Footer configuration saved successfully", "success");
    } catch (err) {
      console.error("Failed to save footer CMS:", err);
      addToast("Failed to update footer settings", "error");
    } finally {
      setIsSavingFooter(false);
    }
  };

  // -------------------------------------------------------------
  // 7. CUSTOM SCRIPTS LOGIC
  // -------------------------------------------------------------
  const handleSaveScripts = async () => {
    if (!customScripts) return;
    setIsSavingScripts(true);
    try {
      const updated = await adminService.updateCustomScripts(customScripts);
      setCustomScripts(updated);
      addToast("Custom tracking scripts saved successfully", "success");
    } catch (err) {
      console.error("Failed to save scripts:", err);
      addToast("Failed to update custom scripts", "error");
    } finally {
      setIsSavingScripts(false);
    }
  };

  // -------------------------------------------------------------
  // TABLE COLUMNS FOR PAGES
  // -------------------------------------------------------------
  const pageColumns = [
    {
      header: "Page Title & Identifier",
      accessor: "title",
      render: (row) => (
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-0.5 flex-shrink-0 border border-blue-100">
            <FaFileAlt className="text-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePreview(row)}
                className="font-bold text-sm text-gray-900 hover:text-blue-600 transition-colors text-left cursor-pointer"
                title="Click to preview page content"
              >
                {row.title}
              </button>
              {row.id && (
                <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                  {row.id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FaGlobe className="text-[10px] text-gray-400" />
              <span className="text-xs text-blue-600 font-mono font-medium">
                /{row.slug}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Content Preview",
      accessor: "content",
      render: (row) => {
        const text = row.content || "";
        const charCount = text.length;
        return (
          <div className="max-w-md">
            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed font-sans">
              {text || <span className="italic text-gray-400">No content</span>}
            </p>
            <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
              {charCount} characters
            </span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      header: "Last Modified",
      accessor: "lastModified",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
          <FaClock className="text-gray-400 text-[11px]" />
          <span>{row.lastModified || row.updatedAt || "N/A"}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handlePreview(row)}
            icon={<FaEye className="text-gray-600" />}
            title="Preview page"
          >
            Preview
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => handleEdit(row)}
            icon={<FaEdit className="text-blue-600" />}
            title="Edit page content"
          >
            Edit Page CMS
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <FaGlobe className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                CMS & Content Management
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Manage dynamic legal pages, homepage hero sections, FAQs, blog articles, promotional banners, and tracking scripts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "pages" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPages(true)}
                disabled={loading || refreshing}
                icon={<FaSync className={refreshing ? "animate-spin text-blue-600" : ""} />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FaPlus />}
                onClick={handleOpenCreatePage}
              >
                Add CMS Page
              </Button>
            </>
          )}

          {activeTab === "homepage" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaSave />}
              onClick={handleSaveHomepage}
              isLoading={isSavingHomepage}
            >
              Save Homepage
            </Button>
          )}

          {activeTab === "faqs" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaPlus />}
              onClick={handleOpenCreateFaq}
            >
              Add FAQ Item
            </Button>
          )}

          {activeTab === "blogs" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaPlus />}
              onClick={handleOpenCreateBlog}
            >
              New Blog Article
            </Button>
          )}

          {activeTab === "banners" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaPlus />}
              onClick={handleOpenCreateBanner}
            >
              Add Promo Banner
            </Button>
          )}

          {activeTab === "footer" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaSave />}
              onClick={handleSaveFooter}
              isLoading={isSavingFooter}
            >
              Save Footer
            </Button>
          )}

          {activeTab === "scripts" && (
            <Button
              variant="primary"
              size="sm"
              icon={<FaSave />}
              onClick={handleSaveScripts}
              isLoading={isSavingScripts}
            >
              Save Scripts
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation Controls */}
      <div className="flex border-b border-gray-200 mb-6 gap-2 sm:gap-4 overflow-x-auto text-xs sm:text-sm font-bold">
        {[
          { id: "pages", label: "Dynamic Pages", icon: <FaFileAlt /> },
          { id: "homepage", label: "Homepage Content", icon: <FaHome /> },
          { id: "faqs", label: "FAQ Items", icon: <FaQuestionCircle /> },
          { id: "blogs", label: "Blog Articles", icon: <FaNewspaper /> },
          { id: "banners", label: "Banners", icon: <FaImage /> },
          { id: "footer", label: "Footer Settings", icon: <FaShareAlt /> },
          { id: "scripts", label: "Custom Scripts", icon: <FaCode /> },
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
      {/* TAB 1: DYNAMIC CMS PAGES */}
      {/* ============================================================= */}
      {activeTab === "pages" && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Total Pages
                </p>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FaFileAlt className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mt-2 font-mono">
                {loading ? <Skeleton className="h-8 w-16" /> : summaryStats.total}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Configured dynamic CMS routes</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Published
                </p>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FaCheckCircle className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
                {loading ? <Skeleton className="h-8 w-16" /> : summaryStats.published}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-emerald-700 font-medium">
                  Live to public visitors
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Draft Pages
                </p>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FaClock className="text-base" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600 mt-2 font-mono">
                {loading ? <Skeleton className="h-8 w-16" /> : summaryStats.draft}
              </h3>
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                Hidden from public visitors
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  Last Updated
                </p>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FaClock className="text-base" />
                </div>
              </div>
              <h3 className="text-base font-bold text-gray-900 mt-2 font-mono truncate">
                {loading ? <Skeleton className="h-6 w-28" /> : summaryStats.latestModified}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">Latest CMS revision</p>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div
              className="flex flex-wrap items-center gap-1.5 bg-gray-100/90 p-1 rounded-xl border border-gray-200 text-xs font-semibold shadow-inner"
              role="group"
            >
              {[
                { id: "all", label: "All Pages", count: summaryStats.total },
                { id: "Published", label: "Published", count: summaryStats.published },
                { id: "Draft", label: "Drafts", count: summaryStats.draft },
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-bold flex items-center gap-1.5 ${
                      isActive
                        ? "bg-white text-blue-700 shadow-sm border border-gray-200/60"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-blue-50 text-blue-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search title, slug, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {(searchQuery || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-gray-500 hover:text-gray-900"
                  title="Reset all filters"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <DataTable
            columns={pageColumns}
            data={filteredPages}
            isLoading={loading}
            emptyMessage={
              searchQuery || statusFilter !== "all"
                ? "No CMS pages found matching the selected filters."
                : "No CMS pages configured yet."
            }
          />
        </>
      )}

      {/* ============================================================= */}
      {/* TAB 2: HOMEPAGE CONTENT */}
      {/* ============================================================= */}
      {activeTab === "homepage" && (
        <div className="space-y-6">
          {homepageLoading || !homepageCms ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Hero & Badges */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                    Hero Section Headlines & Action Links
                  </h3>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Top Announcement Badge Text
                    </label>
                    <Input
                      value={homepageCms.badgeText || ""}
                      onChange={(e) =>
                        setHomepageCms({ ...homepageCms, badgeText: e.target.value })
                      }
                      placeholder="e.g. ⚡ High-Speed Direct API Fulfillment Server"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Hero Headline <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={homepageCms.heroHeadline || ""}
                      onChange={(e) =>
                        setHomepageCms({ ...homepageCms, heroHeadline: e.target.value })
                      }
                      placeholder="Main homepage headline"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Hero Subtitle / Description
                    </label>
                    <textarea
                      rows={3}
                      value={homepageCms.heroSubtitle || ""}
                      onChange={(e) =>
                        setHomepageCms({ ...homepageCms, heroSubtitle: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 p-3 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Primary CTA Button Text
                      </label>
                      <Input
                        value={homepageCms.ctaPrimaryText || ""}
                        onChange={(e) =>
                          setHomepageCms({ ...homepageCms, ctaPrimaryText: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Primary CTA Button Link
                      </label>
                      <Input
                        value={homepageCms.ctaPrimaryLink || ""}
                        onChange={(e) =>
                          setHomepageCms({ ...homepageCms, ctaPrimaryLink: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Secondary CTA Button Text
                      </label>
                      <Input
                        value={homepageCms.ctaSecondaryText || ""}
                        onChange={(e) =>
                          setHomepageCms({ ...homepageCms, ctaSecondaryText: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Secondary CTA Button Link
                      </label>
                      <Input
                        value={homepageCms.ctaSecondaryLink || ""}
                        onChange={(e) =>
                          setHomepageCms({ ...homepageCms, ctaSecondaryLink: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Features Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                    Key Feature Highlights (Homepage Grid)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {homepageCms.features?.map((feat, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                        <Input
                          label={`Feature #${idx + 1} Title`}
                          value={feat.title}
                          onChange={(e) => {
                            const updated = [...homepageCms.features];
                            updated[idx].title = e.target.value;
                            setHomepageCms({ ...homepageCms, features: updated });
                          }}
                        />
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">
                            Description
                          </label>
                          <textarea
                            rows={2}
                            value={feat.description}
                            onChange={(e) => {
                              const updated = [...homepageCms.features];
                              updated[idx].description = e.target.value;
                              setHomepageCms({ ...homepageCms, features: updated });
                            }}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Statistics Counters */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                    Live Statistics Counters
                  </h3>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Active Users Counter
                    </label>
                    <Input
                      value={homepageCms.stats?.activeUsers || ""}
                      onChange={(e) =>
                        setHomepageCms({
                          ...homepageCms,
                          stats: { ...homepageCms.stats, activeUsers: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Orders Completed Counter
                    </label>
                    <Input
                      value={homepageCms.stats?.ordersCompleted || ""}
                      onChange={(e) =>
                        setHomepageCms({
                          ...homepageCms,
                          stats: { ...homepageCms.stats, ordersCompleted: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Server Uptime Counter
                    </label>
                    <Input
                      value={homepageCms.stats?.serverUptime || ""}
                      onChange={(e) =>
                        setHomepageCms({
                          ...homepageCms,
                          stats: { ...homepageCms.stats, serverUptime: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Services Count
                    </label>
                    <Input
                      value={homepageCms.stats?.servicesCount || ""}
                      onChange={(e) =>
                        setHomepageCms({
                          ...homepageCms,
                          stats: { ...homepageCms.stats, servicesCount: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: FAQ ITEMS */}
      {/* ============================================================= */}
      {activeTab === "faqs" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search FAQs by question or answer..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={faqCategoryFilter}
              onChange={(e) => setFaqCategoryFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="Orders">Orders</option>
              <option value="Payments">Payments</option>
              <option value="API & Resellers">API & Resellers</option>
              <option value="General">General</option>
            </select>
          </div>

          {faqsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <FaQuestionCircle className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No FAQ items found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {faq.category}
                      </span>
                      <span className="text-xs font-mono text-gray-400">Order #{faq.order}</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-900">{faq.question}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleFaqStatus(faq)}
                      className="cursor-pointer text-lg"
                      title={faq.status === "Published" ? "Deactivate" : "Publish"}
                    >
                      {faq.status === "Published" ? (
                        <FaToggleOn className="text-emerald-600" />
                      ) : (
                        <FaToggleOff className="text-gray-400" />
                      )}
                    </button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleOpenEditFaq(faq)}
                      icon={<FaEdit className="text-blue-600" />}
                    />
                    <Button
                      size="xs"
                      variant="danger"
                      onClick={() => handleDeleteFaq(faq)}
                      icon={<FaTrash className="text-xs" />}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: BLOG ARTICLES */}
      {/* ============================================================= */}
      {activeTab === "blogs" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search articles by title or category..."
                value={blogSearch}
                onChange={(e) => setBlogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {blogsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <FaNewspaper className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No blog articles found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredBlogs.map((blog) => (
                <div
                  key={blog.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {blog.featuredImage && (
                      <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-36 object-cover"
                      />
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="font-bold text-blue-600 uppercase tracking-wider">
                          {blog.category}
                        </span>
                        <span>{blog.publishedAt}</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 leading-snug line-clamp-2">
                        {blog.title}
                      </h4>
                      <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                        {blog.excerpt || blog.content}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge status={blog.status} size="xs" />
                      <button
                        onClick={() => handleToggleBlogStatus(blog)}
                        className="cursor-pointer text-base"
                      >
                        {blog.status === "Published" ? (
                          <FaToggleOn className="text-emerald-600" />
                        ) : (
                          <FaToggleOff className="text-gray-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleOpenEditBlog(blog)}
                        icon={<FaEdit />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => handleDeleteBlog(blog)}
                        icon={<FaTrash className="text-xs" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 5: BANNERS */}
      {/* ============================================================= */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          {bannersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : banners.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <FaImage className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No promotional banners found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {banner.placement}
                        </span>
                        <span className="text-gray-400 font-mono">{banner.clicks} clicks</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900">{banner.title}</h4>
                      <p className="text-xs text-blue-600 font-mono truncate flex items-center gap-1">
                        <FaLink className="text-[10px]" />
                        <span>{banner.targetUrl}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge status={banner.status} size="xs" />
                      <button
                        onClick={() => handleToggleBannerStatus(banner)}
                        className="cursor-pointer text-base"
                      >
                        {banner.status === "Active" ? (
                          <FaToggleOn className="text-emerald-600" />
                        ) : (
                          <FaToggleOff className="text-gray-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleOpenEditBanner(banner)}
                        icon={<FaEdit />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => handleDeleteBanner(banner)}
                        icon={<FaTrash className="text-xs" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 6: FOOTER SETTINGS */}
      {/* ============================================================= */}
      {activeTab === "footer" && (
        <div className="space-y-6">
          {footerLoading || !footerCms ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                  Footer General Text & Copyright
                </h3>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    About Summary Text
                  </label>
                  <textarea
                    rows={3}
                    value={footerCms.aboutSummary || ""}
                    onChange={(e) =>
                      setFooterCms({ ...footerCms, aboutSummary: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Copyright Line
                  </label>
                  <Input
                    value={footerCms.copyright || ""}
                    onChange={(e) =>
                      setFooterCms({ ...footerCms, copyright: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Quick Links Column Title
                  </label>
                  <Input
                    value={footerCms.quickLinksTitle || ""}
                    onChange={(e) =>
                      setFooterCms({ ...footerCms, quickLinksTitle: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Social Channels & Payment Badges */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                    Social Media Profile Links
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <FaInstagram className="text-pink-600 text-base" />
                      <input
                        type="text"
                        placeholder="Instagram URL"
                        value={footerCms.socialLinks?.instagram || ""}
                        onChange={(e) =>
                          setFooterCms({
                            ...footerCms,
                            socialLinks: { ...footerCms.socialLinks, instagram: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <FaTelegram className="text-sky-500 text-base" />
                      <input
                        type="text"
                        placeholder="Telegram URL"
                        value={footerCms.socialLinks?.telegram || ""}
                        onChange={(e) =>
                          setFooterCms({
                            ...footerCms,
                            socialLinks: { ...footerCms.socialLinks, telegram: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <FaYoutube className="text-red-600 text-base" />
                      <input
                        type="text"
                        placeholder="YouTube URL"
                        value={footerCms.socialLinks?.youtube || ""}
                        onChange={(e) =>
                          setFooterCms({
                            ...footerCms,
                            socialLinks: { ...footerCms.socialLinks, youtube: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <FaTwitter className="text-slate-800 text-base" />
                      <input
                        type="text"
                        placeholder="Twitter / X URL"
                        value={footerCms.socialLinks?.twitter || ""}
                        onChange={(e) =>
                          setFooterCms({
                            ...footerCms,
                            socialLinks: { ...footerCms.socialLinks, twitter: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                    Accepted Payment Method Badges
                  </h3>

                  <div className="space-y-2">
                    {footerCms.paymentBadges?.map((badge, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                      >
                        <span className="font-semibold text-gray-800 flex items-center gap-2">
                          <FaCreditCard className="text-blue-600" />
                          <span>{badge.name}</span>
                        </span>
                        <button
                          onClick={() => {
                            const updated = [...footerCms.paymentBadges];
                            updated[idx].enabled = !updated[idx].enabled;
                            setFooterCms({ ...footerCms, paymentBadges: updated });
                          }}
                          className="cursor-pointer text-base"
                        >
                          {badge.enabled ? (
                            <FaToggleOn className="text-emerald-600" />
                          ) : (
                            <FaToggleOff className="text-gray-400" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 7: CUSTOM SCRIPTS */}
      {/* ============================================================= */}
      {activeTab === "scripts" && (
        <div className="space-y-6">
          {scriptsLoading || !customScripts ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2.5">
                <FaShieldAlt className="text-base text-amber-600 shrink-0" />
                <span>
                  <strong>Safe Script Injection:</strong> Injected tracking scripts (Google Analytics, Meta Pixel, Chat widgets) load asynchronously in visitor sandboxes. Never insert unverified third-party token secrets.
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-2">
                  <label className="font-bold text-sm text-gray-900 block">
                    Header Tracking Scripts (&lt;head&gt;)
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Google Analytics (gtag.js), Google Tag Manager, Search Console meta tags
                  </p>
                  <textarea
                    rows={8}
                    value={customScripts.headerScripts || ""}
                    onChange={(e) =>
                      setCustomScripts({ ...customScripts, headerScripts: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs font-mono bg-slate-900 text-emerald-400"
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-2">
                  <label className="font-bold text-sm text-gray-900 block">
                    Body Start Tracking Scripts
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Meta Pixel noscript, Google Tag Manager body fallback code
                  </p>
                  <textarea
                    rows={8}
                    value={customScripts.bodyStartScripts || ""}
                    onChange={(e) =>
                      setCustomScripts({ ...customScripts, bodyStartScripts: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs font-mono bg-slate-900 text-emerald-400"
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-2">
                  <label className="font-bold text-sm text-gray-900 block">
                    Footer Body Scripts (&lt;/body&gt;)
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Live chat widgets (Tawk.to, Crisp, Intercom), popup conversion triggers
                  </p>
                  <textarea
                    rows={8}
                    value={customScripts.footerScripts || ""}
                    onChange={(e) =>
                      setCustomScripts({ ...customScripts, footerScripts: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs font-mono bg-slate-900 text-emerald-400"
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-2">
                  <label className="font-bold text-sm text-gray-900 block">
                    Custom CSS Overrides
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Custom brand styling, color gradients, layout tweaks
                  </p>
                  <textarea
                    rows={8}
                    value={customScripts.customCss || ""}
                    onChange={(e) =>
                      setCustomScripts({ ...customScripts, customCss: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs font-mono bg-slate-900 text-sky-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: PREVIEW DYNAMIC PAGE */}
      {/* ============================================================ */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setActivePage(null);
        }}
        title={`Preview Page: ${activePage?.title || ""}`}
        size="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-500 font-mono">
              Path: /{activePage?.slug}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewModalOpen(false);
                  setActivePage(null);
                }}
              >
                Close Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FaEdit />}
                onClick={() => {
                  setPreviewModalOpen(false);
                  handleEdit(activePage);
                }}
              >
                Edit This Page
              </Button>
            </div>
          </div>
        }
      >
        {activePage && (
          <div className="space-y-5">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900">
                  {activePage.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    /{activePage.slug}
                  </span>
                  <button
                    onClick={() => handleCopySlug(activePage.slug)}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                    title="Copy path"
                  >
                    <FaCopy className="text-[11px]" />
                    <span>{copiedSlug ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge status={activePage.status} size="sm" />
                <div className="text-right text-[11px] text-gray-500 font-mono">
                  <span>Last Modified:</span>
                  <p className="font-semibold text-gray-700">
                    {activePage.lastModified || activePage.updatedAt || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Page Body Content
              </p>
              <div className="p-5 bg-white rounded-xl border border-gray-200 max-h-96 overflow-y-auto shadow-inner">
                <SafeContentRenderer content={activePage.content} />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono pt-2 border-t border-gray-100">
              <span>
                Total Characters: {activePage.content ? activePage.content.length : 0}
              </span>
              <span>
                Total Words:{" "}
                {activePage.content
                  ? activePage.content.trim().split(/\s+/).filter(Boolean).length
                  : 0}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: EDIT DYNAMIC PAGE */}
      {/* ============================================================ */}
      <Modal
        isOpen={editModalOpen}
        onClose={handleCloseEdit}
        title={`Edit CMS Page: ${activePage?.title || ""}`}
        size="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved Changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FaSave />}
                onClick={handleSave}
                isLoading={isSaving}
                disabled={isSaving}
              >
                Save & Publish Page
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Page Title"
                required
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (formErrors.title) setFormErrors({ ...formErrors, title: null });
                }}
                error={formErrors.title}
                placeholder="e.g. Terms & Conditions"
              />
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                {formData.title.length}/100 characters
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  URL Slug (Read-only)
                </label>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <FaLock className="text-[9px]" /> Locked
                </span>
              </div>
              <Input
                disabled
                value={formData.slug}
                className="bg-gray-100 font-mono text-gray-600"
              />
              <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                Public URL: /{formData.slug}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Page Body Content <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-500 font-mono">
                {formData.content.length} / 10,000 chars
              </span>
            </div>
            <textarea
              rows={12}
              required
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value });
                if (formErrors.content) setFormErrors({ ...formErrors, content: null });
              }}
              placeholder="Enter formatted terms, policy statements, FAQs, or page text..."
              className={`w-full rounded-xl border p-3 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed transition ${
                formErrors.content ? "border-rose-400 bg-rose-50/30" : "border-gray-300"
              }`}
            />
            {formErrors.content ? (
              <p className="text-xs text-rose-600 mt-1">{formErrors.content}</p>
            ) : (
              <p className="text-[11px] text-gray-500 mt-1">
                Formatted markdown & plain text supported. Paragraphs, numbered clauses, and line breaks are preserved safely.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publish Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Published">Published (Live to Public Visitors)</option>
              <option value="Draft">Draft (Internal Only - Hidden from Visitors)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: CREATE NEW DYNAMIC PAGE */}
      {/* ============================================================ */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New CMS Page"
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreatePageSubmit}
              isLoading={isSaving}
            >
              Create Page
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreatePageSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Page Title"
              required
              value={formData.title}
              onChange={(e) => {
                const title = e.target.value;
                const slug = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
                setFormData({ ...formData, title, slug: formData.slug || slug });
              }}
              error={formErrors.title}
              placeholder="e.g. Developer Guidelines"
            />

            <Input
              label="URL Slug"
              required
              value={formData.slug}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                })
              }
              placeholder="e.g. developer-guidelines"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500"
              placeholder="Enter page content..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-2 text-sm bg-white"
            >
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: CREATE / EDIT FAQ */}
      {/* ============================================================ */}
      <Modal
        isOpen={faqModalOpen}
        onClose={() => setFaqModalOpen(false)}
        title={faqModalMode === "create" ? "Add FAQ Item" : "Edit FAQ Item"}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setFaqModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFaqFormSubmit}
              isLoading={isFaqSubmitting}
            >
              {faqModalMode === "create" ? "Add FAQ" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleFaqFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Category</label>
              <select
                value={faqForm.category}
                onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
              >
                <option value="Orders">Orders</option>
                <option value="Payments">Payments</option>
                <option value="API & Resellers">API & Resellers</option>
                <option value="General">General</option>
              </select>
            </div>
            <Input
              label="Display Order"
              type="number"
              value={faqForm.order}
              onChange={(e) => setFaqForm({ ...faqForm, order: e.target.value })}
            />
          </div>

          <Input
            label="Question"
            required
            value={faqForm.question}
            onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
            error={faqErrors.question}
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Answer <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={faqForm.answer}
              onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
            />
            {faqErrors.answer && (
              <p className="text-xs text-rose-500 mt-1">{faqErrors.answer}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 5: CREATE / EDIT BLOG */}
      {/* ============================================================ */}
      <Modal
        isOpen={blogModalOpen}
        onClose={() => setBlogModalOpen(false)}
        title={blogModalMode === "create" ? "Create Blog Article" : "Edit Blog Article"}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setBlogModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBlogFormSubmit}
              isLoading={isBlogSubmitting}
            >
              {blogModalMode === "create" ? "Publish Article" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleBlogFormSubmit} className="space-y-4">
          <Input
            label="Article Title"
            required
            value={blogForm.title}
            onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
            error={blogErrors.title}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Category"
              value={blogForm.category}
              onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
            />
            <Input
              label="Author Name"
              value={blogForm.author}
              onChange={(e) => setBlogForm({ ...blogForm, author: e.target.value })}
            />
          </div>

          <Input
            label="Featured Image URL"
            value={blogForm.featuredImage}
            onChange={(e) => setBlogForm({ ...blogForm, featuredImage: e.target.value })}
            placeholder="https://images.unsplash.com/..."
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Short Excerpt / Teaser
            </label>
            <textarea
              rows={2}
              value={blogForm.excerpt}
              onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Full Content Body <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={blogForm.content}
              onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-mono"
            />
            {blogErrors.content && (
              <p className="text-xs text-rose-500 mt-1">{blogErrors.content}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 6: CREATE / EDIT BANNER */}
      {/* ============================================================ */}
      <Modal
        isOpen={bannerModalOpen}
        onClose={() => setBannerModalOpen(false)}
        title={bannerModalMode === "create" ? "Add Promotional Banner" : "Edit Banner"}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setBannerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBannerFormSubmit}
              isLoading={isBannerSubmitting}
            >
              {bannerModalMode === "create" ? "Add Banner" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleBannerFormSubmit} className="space-y-4">
          <Input
            label="Banner Title"
            required
            value={bannerForm.title}
            onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
            error={bannerErrors.title}
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Placement</label>
            <select
              value={bannerForm.placement}
              onChange={(e) => setBannerForm({ ...bannerForm, placement: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
            >
              <option value="Top Header Banner">Top Header Banner</option>
              <option value="Hero Banner">Hero Banner</option>
              <option value="Sidebar Promo">Sidebar Promo</option>
              <option value="Footer Banner">Footer Banner</option>
            </select>
          </div>

          <Input
            label="Image URL"
            required
            value={bannerForm.imageUrl}
            onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
            placeholder="https://images.unsplash.com/..."
            error={bannerErrors.imageUrl}
          />

          <Input
            label="Target Link / URL"
            value={bannerForm.targetUrl}
            onChange={(e) => setBannerForm({ ...bannerForm, targetUrl: e.target.value })}
            placeholder="/services"
          />
        </form>
      </Modal>

      {/* Confirmation Dialog */}
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
        confirmText="Delete"
        isLoading={confirmDialog.isLoading}
      />
    </AdminLayout>
  );
}

export default AdminCmsPages;
