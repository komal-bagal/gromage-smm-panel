/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheck,
  FaBan,
  FaCloudDownloadAlt,
  FaPercentage,
  FaSync,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const EMPTY_SERVICE_FORM = {
  name: "",
  category: "",
  provider: "",
  cost: "",
  rate: "",
  min: 100,
  max: 10000,
  status: "Active",
  providerServiceId: "",
};

const DEFAULT_BULK_PRICE_FORM = {
  type: "percent",
  value: 20,
  target: "selected",
};

const DEFAULT_IMPORT_FORM = {
  providerId: "",
  marginPercent: 25,
};

function AdminServices() {
  const { addToast } = useToast();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [editingService, setEditingService] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    item: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);

  const [bulkPriceForm, setBulkPriceForm] = useState(
    DEFAULT_BULK_PRICE_FORM
  );

  const [importForm, setImportForm] = useState(DEFAULT_IMPORT_FORM);

  const [importProgress, setImportProgress] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [serviceData, categoryData, providerData] = await Promise.all([
        adminService.getServices(),
        adminService.getCategories(),
        adminService.getProviders(),
      ]);

      setServices(Array.isArray(serviceData) ? serviceData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setProviders(Array.isArray(providerData) ? providerData : []);

      if (!importForm.providerId && providerData?.length > 0) {
        setImportForm((prev) => ({
          ...prev,
          providerId: providerData[0].id,
        }));
      }
    } catch {
      addToast("Failed to load services data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, importForm.providerId]);

  const reloadServices = useCallback(async () => {
    try {
      const freshServices = await adminService.getServices();
      setServices(Array.isArray(freshServices) ? freshServices : []);
      return freshServices;
    } catch (err) {
      console.error("Failed to reload services from GET:", err);
      addToast("Failed to refresh services from server", "error");
      throw err;
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetServiceForm = () => {
    setServiceForm({
      ...EMPTY_SERVICE_FORM,
      category: categories[0]?.name || "",
      provider: providers[0]?.name || "",
    });
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    resetServiceForm();
    setServiceModalOpen(true);
  };

  const handleOpenEdit = (service) => {
    setEditingService(service);

    setServiceForm({
      name: service.name || "",
      category: service.category || "",
      provider: service.provider || "",
      cost: service.cost ?? "",
      rate: service.rate ?? "",
      min: service.min ?? 100,
      max: service.max ?? 10000,
      status: service.status || "Active",
      providerServiceId: service.providerServiceId || "",
    });

    setServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    if (isSubmitting) {
      return;
    }

    setServiceModalOpen(false);
    setEditingService(null);
    resetServiceForm();
  };

  const validateServiceForm = () => {
    const name = String(serviceForm.name || "").trim();
    const category = String(serviceForm.category || "").trim();
    const provider = String(serviceForm.provider || "").trim();

    const cost =
      serviceForm.cost === "" ? 0 : Number(serviceForm.cost);

    const rate = Number(serviceForm.rate);
    const min = Number(serviceForm.min);
    const max = Number(serviceForm.max);

    if (!name) {
      addToast("Service name is required", "error");
      return false;
    }

    if (!category) {
      addToast("Please select a category", "error");
      return false;
    }

    if (!provider) {
      addToast("Please select a provider", "error");
      return false;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      addToast("Provider cost must be 0 or greater", "error");
      return false;
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      addToast("Selling rate must be greater than 0", "error");
      return false;
    }

    if (!Number.isInteger(min) || min <= 0) {
      addToast("Minimum order must be greater than 0", "error");
      return false;
    }

    if (!Number.isInteger(max) || max <= min) {
      addToast("Maximum order must be greater than minimum order", "error");
      return false;
    }

    return true;
  };

  const handleSaveService = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    if (!validateServiceForm()) {
      return;
    }

    const payload = {
      name: String(serviceForm.name).trim(),
      category: String(serviceForm.category).trim(),
      provider: String(serviceForm.provider).trim(),
      cost: Number(serviceForm.cost || 0),
      rate: Number(serviceForm.rate),
      min: Number(serviceForm.min),
      max: Number(serviceForm.max),
      status: serviceForm.status,
      providerServiceId: String(
        serviceForm.providerServiceId || ""
      ).trim(),
    };

    setIsSubmitting(true);

    try {
      if (editingService) {
        await adminService.updateService(editingService.id, payload);
        await reloadServices();
        addToast("Service updated successfully", "success");
      } else {
        await adminService.createService(payload);
        await reloadServices();
        addToast("Service created successfully", "success");
      }

      setServiceModalOpen(false);
      setEditingService(null);
      resetServiceForm();
    } catch {
      addToast("Failed to save service", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (service) => {
    const nextStatus =
      service.status === "Active" ? "Disabled" : "Active";

    try {
      await adminService.updateServiceStatus(service.id, nextStatus);
      await reloadServices();

      addToast(
        `Service marked as ${nextStatus}`,
        "success"
      );
    } catch {
      addToast("Failed to update service status", "error");
    }
  };

  const openDeleteConfirm = (service) => {
    setDeleteConfirm({
      isOpen: true,
      item: service,
    });
  };

  const closeDeleteConfirm = () => {
    if (isSubmitting) {
      return;
    }

    setDeleteConfirm({
      isOpen: false,
      item: null,
    });
  };

  const handleDeleteService = async () => {
    const item = deleteConfirm.item;

    if (!item) {
      return;
    }

    setIsSubmitting(true);

    try {
      await adminService.deleteService(item.id);
      await reloadServices();

      setSelectedIds((prev) =>
        prev.filter((id) => id !== item.id)
      );

      addToast("Service removed successfully", "success");
    } catch {
      addToast("Failed to delete service", "error");
    } finally {
      setIsSubmitting(false);
      setDeleteConfirm({
        isOpen: false,
        item: null,
      });
    }
  };

  const validateBulkPriceForm = () => {
    const value = Number(bulkPriceForm.value);

    if (!Number.isFinite(value) || value < 0) {
      addToast(
        "Markup value must be 0 or greater",
        "error"
      );
      return false;
    }

    if (
      bulkPriceForm.type === "percent" &&
      value > 1000
    ) {
      addToast(
        "Percentage markup cannot exceed 1000%",
        "error"
      );
      return false;
    }

    if (
      bulkPriceForm.target === "selected" &&
      selectedIds.length === 0
    ) {
      addToast(
        "Select at least one service",
        "error"
      );
      return false;
    }

    return true;
  };

  const handleBulkPriceApply = async () => {
    if (!validateBulkPriceForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await adminService.bulkUpdateServices({
        ids:
          bulkPriceForm.target === "all"
            ? services.map((service) => service.id)
            : selectedIds,
        priceType: bulkPriceForm.type,
        value: Number(bulkPriceForm.value),
      });

      await reloadServices();

      addToast(
        "Bulk price markup updated successfully",
        "success"
      );

      setBulkPriceModalOpen(false);
      setSelectedIds([]);
    } catch {
      addToast(
        "Failed to apply bulk pricing",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetImportForm = () => {
    setImportForm({
      providerId: providers[0]?.id || "",
      marginPercent: 25,
    });

    setImportProgress(null);
  };

  const handleOpenImport = () => {
    setImportForm((prev) => ({
      ...prev,
      providerId:
        prev.providerId ||
        providers[0]?.id ||
        "",
    }));

    setImportProgress(null);
    setImportModalOpen(true);
  };

  const handleRunImport = async () => {
    if (!importForm.providerId) {
      addToast("Please select a provider", "error");
      return;
    }

    const margin = Number(importForm.marginPercent);

    if (!Number.isFinite(margin) || margin < 0) {
      addToast(
        "Profit margin must be 0 or greater",
        "error"
      );
      return;
    }

    setImportProgress({
      status: "syncing",
      message: "Preparing provider service import...",
    });

    try {
      const result = await adminService.importServices(
        importForm.providerId
      );

      const importedCount = Number(
        result?.importedCount ?? 0
      );

      const newCount = Number(
        result?.newCount ?? 0
      );

      const updatedCount = Number(
        result?.updatedCount ?? 0
      );

      setImportProgress({
        status: "done",
        message: `Import complete: ${importedCount} services processed, ${newCount} new, ${updatedCount} updated.`,
      });

      addToast(
        `Provider import completed with ${importedCount} services processed`,
        "success"
      );
    } catch {
      setImportProgress({
        status: "error",
        message:
          "Unable to complete the provider import.",
      });

      addToast(
        "Provider import failed",
        "error"
      );
    }
  };

  const handleCloseImport = () => {
    if (importProgress?.status === "syncing") {
      return;
    }

    setImportModalOpen(false);
    resetImportForm();
  };

  const filteredServices = services.filter((service) => {
    const serviceName = String(
      service.name || ""
    ).toLowerCase();

    const providerServiceId = String(
      service.providerServiceId || ""
    ).toLowerCase();

    const searchValue = String(
      search || ""
    ).toLowerCase();

    const matchesSearch =
      serviceName.includes(searchValue) ||
      String(service.id || "").includes(searchValue) ||
      providerServiceId.includes(searchValue);

    const matchesCategory =
      categoryFilter === "all" ||
      service.category === categoryFilter;

    const matchesProvider =
      providerFilter === "all" ||
      service.provider === providerFilter;

    const matchesStatus =
      statusFilter === "all" ||
      service.status === statusFilter;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesProvider &&
      matchesStatus
    );
  });

  const totalServices = services.length;

  const activeServices = services.filter(
    (service) => service.status === "Active"
  ).length;

  const disabledServices = services.filter(
    (service) => service.status === "Disabled"
  ).length;

  const columns = [
    {
      header: "ID",
      accessor: "id",
      sortable: true,
      className:
        "w-16 font-mono font-bold text-xs text-blue-600",
    },

    {
      header: "Service Details",
      accessor: "name",
      sortable: true,
      render: (row) => (
        <div className="max-w-md">
          <p className="font-semibold text-gray-900 text-sm">
            {row.name}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {row.category}
            </span>

            <span>•</span>

            <span className="font-mono text-slate-500">
              Provider: {row.provider}
            </span>

            {row.providerServiceId && (
              <>
                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                  ID: {row.providerServiceId}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },

    {
      header: "Rate / 1k",
      accessor: "rate",
      sortable: true,
      render: (row) => {
        const rate = Number(row.rate || 0);
        const cost = Number(row.cost || 0);

        return (
          <div>
            <span className="font-mono font-bold text-gray-900 text-sm">
              ₹{rate.toFixed(2)}
            </span>

            {cost > 0 && (
              <p className="text-[10px] text-gray-400 font-mono">
                Cost: ₹{cost.toFixed(2)}
              </p>
            )}
          </div>
        );
      },
    },

    {
      header: "Min / Max",
      accessor: "min",
      sortable: true,
      render: (row) => {
        const min = Number(row.min || 0);
        const max = Number(row.max || 0);

        return (
          <div className="text-xs text-gray-600 font-mono">
            <span>{min.toLocaleString()}</span>
            {" / "}
            <span>{max.toLocaleString()}</span>
          </div>
        );
      },
    },

    {
      header: "Status",
      accessor: "status",
      render: (row) => (
        <Badge
          status={row.status}
          size="xs"
        />
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
            title="Edit Service"
            onClick={() => handleOpenEdit(row)}
            icon={
              <FaEdit className="text-blue-600" />
            }
          />

          <Button
            size="xs"
            variant={
              row.status === "Active"
                ? "outline"
                : "success"
            }
            title={
              row.status === "Active"
                ? "Disable Service"
                : "Enable Service"
            }
            onClick={() =>
              handleToggleStatus(row)
            }
            icon={
              row.status === "Active" ? (
                <FaBan className="text-amber-600" />
              ) : (
                <FaCheck className="text-white" />
              )
            }
          />

          <Button
            size="xs"
            variant="danger"
            title="Delete Service"
            onClick={() =>
              openDeleteConfirm(row)
            }
            icon={<FaTrash />}
          />
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Service Management
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage services, pricing, categories, providers,
            status and bulk operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<FaSync className={loading ? "animate-spin" : ""} />}
            onClick={() => loadData()}
            disabled={loading}
          >
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<FaPercentage />}
            onClick={() =>
              setBulkPriceModalOpen(true)
            }
          >
            Bulk Price Margin
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<FaCloudDownloadAlt />}
            onClick={handleOpenImport}
          >
            Import via Provider API
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaPlus />}
            onClick={handleOpenAdd}
          >
            Add Service
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500">
            Total Services
          </p>
          <p className="text-2xl font-black text-gray-900 mt-1">
            {totalServices}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500">
            Active
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {activeServices}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500">
            Disabled
          </p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {disabledServices}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500">
            Selected
          </p>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {selectedIds.length}
          </p>
        </div>
      </div>

      {/* Services Table */}
      <DataTable
        columns={columns}
        data={filteredServices}
        isLoading={loading}
        searchPlaceholder="Search by service name, ID or provider ID..."
        searchValue={search}
        onSearch={setSearch}
        selectable
        selectedRows={selectedIds}
        onSelectRow={(id, checked) =>
          setSelectedIds((prev) =>
            checked
              ? prev.includes(id)
                ? prev
                : [...prev, id]
              : prev.filter(
                  (selectedId) =>
                    selectedId !== id
                )
          )
        }
        onSelectAll={(ids) =>
          setSelectedIds(
            Array.isArray(ids) ? ids : []
          )
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">
                All Categories
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.name}
                >
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={providerFilter}
              onChange={(event) =>
                setProviderFilter(
                  event.target.value
                )
              }
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">
                All Providers
              </option>

              {providers.map((provider) => (
                <option
                  key={provider.id}
                  value={provider.name}
                >
                  {provider.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="Active">
                Active
              </option>

              <option value="Disabled">
                Disabled
              </option>
            </select>
          </div>
        }
      />

      {/* Add / Edit Service Modal */}
      <Modal
        isOpen={serviceModalOpen}
        onClose={closeServiceModal}
        title={
          editingService
            ? "Edit Service"
            : "Add New Service"
        }
        subtitle={
          editingService
            ? "Update service details and pricing."
            : "Create a new service in the catalog."
        }
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeServiceModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveService}
              isLoading={isSubmitting}
            >
              {editingService
                ? "Save Changes"
                : "Create Service"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={handleSaveService}
          className="space-y-4"
        >
          <Input
            label="Service Name"
            required
            placeholder="e.g. Instagram Followers - High Quality"
            value={serviceForm.name}
            onChange={(event) =>
              setServiceForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>

              <select
                value={serviceForm.category}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    category: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  Select category
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.name}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>

              <select
                value={serviceForm.provider}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    provider: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  Select provider
                </option>

                {providers.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.name}
                  >
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Provider Cost (₹)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.15"
              value={serviceForm.cost}
              onChange={(event) =>
                setServiceForm((prev) => ({
                  ...prev,
                  cost: event.target.value,
                }))
              }
            />

            <Input
              label="Selling Rate / 1k (₹)"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.25"
              value={serviceForm.rate}
              onChange={(event) =>
                setServiceForm((prev) => ({
                  ...prev,
                  rate: event.target.value,
                }))
              }
            />

            <Input
              label="Provider Service ID"
              placeholder="e.g. SK-901"
              value={
                serviceForm.providerServiceId
              }
              onChange={(event) =>
                setServiceForm((prev) => ({
                  ...prev,
                  providerServiceId:
                    event.target.value,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Minimum Order"
              type="number"
              min="1"
              step="1"
              required
              value={serviceForm.min}
              onChange={(event) =>
                setServiceForm((prev) => ({
                  ...prev,
                  min: event.target.value,
                }))
              }
            />

            <Input
              label="Maximum Order"
              type="number"
              min="1"
              step="1"
              required
              value={serviceForm.max}
              onChange={(event) =>
                setServiceForm((prev) => ({
                  ...prev,
                  max: event.target.value,
                }))
              }
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>

              <select
                value={serviceForm.status}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">
                  Active
                </option>

                <option value="Disabled">
                  Disabled
                </option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">
              Selling rate, provider cost, minimum order
              and maximum order are validated before saving.
            </p>
          </div>
        </form>
      </Modal>

      {/* Bulk Price Margin Modal */}
      <Modal
        isOpen={bulkPriceModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setBulkPriceModalOpen(false);
          }
        }}
        title="Bulk Price Margin Markup"
        subtitle="Adjust selling rates for selected or all services."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBulkPriceModalOpen(false)
              }
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkPriceApply}
              isLoading={isSubmitting}
            >
              Apply Price Markup
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apply Markup To
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setBulkPriceForm((prev) => ({
                    ...prev,
                    target: "selected",
                  }))
                }
                className={`py-3 px-3 text-xs font-semibold rounded-lg border transition ${
                  bulkPriceForm.target ===
                  "selected"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Selected Services (
                {selectedIds.length})
              </button>

              <button
                type="button"
                onClick={() =>
                  setBulkPriceForm((prev) => ({
                    ...prev,
                    target: "all",
                  }))
                }
                className={`py-3 px-3 text-xs font-semibold rounded-lg border transition ${
                  bulkPriceForm.target === "all"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                All Services ({services.length})
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adjustment Type
            </label>

            <select
              value={bulkPriceForm.type}
              onChange={(event) =>
                setBulkPriceForm((prev) => ({
                  ...prev,
                  type: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="percent">
                Percentage Markup (+% increase)
              </option>

              <option value="fixed">
                Fixed Price Addition (+₹ amount)
              </option>
            </select>
          </div>

          <Input
            label={
              bulkPriceForm.type === "percent"
                ? "Markup Percentage (%)"
                : "Markup Amount (₹)"
            }
            type="number"
            min="0"
            step="0.01"
            required
            value={bulkPriceForm.value}
            onChange={(event) =>
              setBulkPriceForm((prev) => ({
                ...prev,
                value: event.target.value,
              }))
            }
          />

          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-xs text-blue-700">
              {bulkPriceForm.target === "all"
                ? `This will update ${services.length} services.`
                : `${selectedIds.length} selected service(s) will be updated.`}
            </p>
          </div>
        </div>
      </Modal>

      {/* Provider Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={handleCloseImport}
        title="Sync & Import Services"
        subtitle="Provider import is currently shown using mock data."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseImport}
              disabled={
                importProgress?.status ===
                "syncing"
              }
            >
              Close
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleRunImport}
              isLoading={
                importProgress?.status ===
                "syncing"
              }
            >
              Start Sync & Import
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Provider
            </label>

            <select
              value={importForm.providerId}
              onChange={(event) =>
                setImportForm((prev) => ({
                  ...prev,
                  providerId:
                    event.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                Select provider
              </option>

              {providers.map((provider) => (
                <option
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Profit Margin Markup (%)"
            type="number"
            min="0"
            step="0.01"
            value={importForm.marginPercent}
            helperText="Mock UI setting for the selling-price margin applied during a future provider import integration."
            onChange={(event) =>
              setImportForm((prev) => ({
                ...prev,
                marginPercent:
                  event.target.value,
              }))
            }
          />

          {importProgress && (
            <div
              className={`p-4 rounded-xl border text-sm font-medium flex items-start gap-3 ${
                importProgress.status ===
                "syncing"
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : importProgress.status === "done"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {importProgress.status ===
                "syncing" && (
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
              )}

              {importProgress.status ===
                "done" && (
                <FaCheck className="text-emerald-600 mt-0.5 shrink-0" />
              )}

              {importProgress.status ===
                "error" && (
                <FaBan className="text-rose-600 mt-0.5 shrink-0" />
              )}

              <span>
                {importProgress.message}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteService}
        title="Delete Service"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name || "this service"}"? Customers will no longer be able to place new orders for this service.`}
        confirmText="Delete Service"
        variant="danger"
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminServices;