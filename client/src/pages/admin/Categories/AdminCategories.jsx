/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaBan } from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

function AdminCategories() {
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", slug: "", sortOrder: 1, status: "Active" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getCategories();
      setCategories(data);
    } catch {
      addToast("Failed to fetch categories", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      sortOrder: categories.length + 1,
      status: "Active",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
      status: cat.status,
    });
    setModalOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : slug,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      addToast("Category name is required", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const updated = await adminService.updateCategory(editingCategory.id, formData);
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, ...updated, ...formData } : c))
        );
        addToast("Category updated successfully", "success");
      } else {
        const created = await adminService.createCategory(formData);
        const newCat = {
          serviceCount: 0,
          ...formData,
          ...(created || {}),
        };
        setCategories((prev) => [...prev, newCat]);
        addToast("Category created successfully", "success");
      }
      setModalOpen(false);
    } catch {
      addToast("Failed to save category", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const { item } = deleteConfirm;
    setIsSubmitting(true);
    try {
      await adminService.deleteCategory(item.id);
      setCategories((prev) => prev.filter((c) => c.id !== item.id));
      addToast("Category deleted successfully", "success");
    } catch {
      addToast("Failed to delete category", "error");
    } finally {
      setIsSubmitting(false);
      setDeleteConfirm({ isOpen: false, item: null });
    }
  };

  const handleToggleStatus = async (cat) => {
    const nextStatus = cat.status === "Active" ? "Disabled" : "Active";
    try {
      await adminService.updateCategory(cat.id, { status: nextStatus });
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, status: nextStatus } : c))
      );
      addToast(`Category marked as ${nextStatus}`, "success");
    } catch {
      addToast("Status update failed", "error");
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      header: "Sort #",
      accessor: "sortOrder",
      sortable: true,
      className: "w-16 font-bold text-center text-gray-500",
    },
    {
      header: "Category Name",
      accessor: "name",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900 text-sm">{row.name}</p>
          <p className="text-xs text-gray-400 font-mono">/{row.slug}</p>
        </div>
      ),
    },
    {
      header: "Services Count",
      accessor: "serviceCount",
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
          {row.serviceCount} Services
        </span>
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
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            title="Edit Category"
            onClick={() => handleOpenEdit(row)}
            icon={<FaEdit className="text-blue-600" />}
          />
          <Button
            size="xs"
            variant={row.status === "Active" ? "outline" : "success"}
            title={row.status === "Active" ? "Disable Category" : "Enable Category"}
            onClick={() => handleToggleStatus(row)}
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
            title="Delete Category"
            onClick={() => setDeleteConfirm({ isOpen: true, item: row })}
            icon={<FaTrash />}
          />
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Category Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Organize service categories, sort orders, and visibility on the user panel
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<FaPlus />}
          onClick={handleOpenCreate}
        >
          Add New Category
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredCategories}
        isLoading={loading}
        searchPlaceholder="Search categories..."
        searchValue={search}
        onSearch={setSearch}
      />

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Create New Category"}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            required
            placeholder="e.g. Instagram High Quality Followers"
            value={formData.name}
            onChange={handleNameChange}
          />

          <Input
            label="URL Slug"
            required
            placeholder="e.g. instagram-followers"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sort Order"
              type="number"
              min="1"
              required
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete '${deleteConfirm.item?.name}'? If this category contains services, they will become unassigned.`}
        confirmText="Delete Category"
        variant="danger"
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminCategories;
