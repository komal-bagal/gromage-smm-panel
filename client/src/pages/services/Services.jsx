/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [srvRes, catRes] = await Promise.allSettled([
        api.get("/api/service"),
        api.get("/api/category"),
      ]);

      if (srvRes.status === "fulfilled" && srvRes.value.data?.services) {
        setServices(
          srvRes.value.data.services.filter(
            (s) => s.status !== "inactive" && s.status !== "disabled"
          )
        );
      } else {
        setServices([]);
      }

      if (catRes.status === "fulfilled" && catRes.value.data?.categories) {
        setCategories(catRes.value.data.categories);
      }
    } catch (err) {
      console.error("Fetch services error:", err);
      setError("Failed to load services from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const categoryOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    categories.forEach((c) => {
      if (c && c.status !== "inactive" && c.name && !seen.has(c.name.toLowerCase())) {
        seen.add(c.name.toLowerCase());
        list.push(c.name);
      }
    });

    services.forEach((s) => {
      const cat = s.category || (categories.find((c) => c._id === s.categoryId)?.name);
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        list.push(cat);
      }
    });

    return list;
  }, [categories, services]);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const srvCat = srv.category || (categories.find((c) => c._id === srv.categoryId)?.name) || "";
      const matchesSearch =
        !searchTerm ||
        (srv.name && srv.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (srvCat && srvCat.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (srv.description && srv.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === "all" ||
        srvCat.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [services, categories, searchTerm, selectedCategory]);

  return (
    <DashboardLayout>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
            Services
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Browse our full catalog of active social media marketing services
          </p>
        </div>

        <button
          onClick={() => navigate("/new-order")}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold transition cursor-pointer"
        >
          + New Order
        </button>
      </div>

      {/* Services Card */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Service by name or category..."
            className="flex-1 border rounded-lg p-2.5 sm:p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded-lg p-2.5 sm:p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-medium cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-3 rounded-lg mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Table / Content */}
        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            Loading service catalog...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="font-semibold text-base">No services available</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your search query or category filter."
                : "No active services are configured on the platform."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-3">Service</th>
                  <th className="text-left py-3 px-3">Category</th>
                  <th className="text-left py-3 px-3">Rate / 1K</th>
                  <th className="text-left py-3 px-3">Min</th>
                  <th className="text-left py-3 px-3">Max</th>
                  <th className="text-right py-3 px-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredServices.map((service) => (
                  <tr key={service._id || service.id} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-3">
                      <p className="font-medium text-gray-800">{service.name}</p>
                      {service.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{service.description}</p>
                      )}
                    </td>
                    <td className="px-3 text-gray-600">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {service.category || (categories.find((c) => c._id === service.categoryId)?.name) || "General"}
                      </span>
                    </td>
                    <td className="px-3 font-semibold text-emerald-600">
                      ₹{Number(service.rate || service.price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 text-gray-600">
                      {Number(service.min || 1).toLocaleString()}
                    </td>
                    <td className="px-3 text-gray-600">
                      {service.max ? Number(service.max).toLocaleString() : "100,000"}
                    </td>
                    <td className="px-3 text-right">
                      <button
                        onClick={() => navigate("/new-order")}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Order →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Scroll Hint */}
        <p className="text-xs text-gray-400 mt-4 md:hidden">
          ← Swipe horizontally to see complete rates and limits →
        </p>

      </div>

    </DashboardLayout>
  );
}

export default Services;
