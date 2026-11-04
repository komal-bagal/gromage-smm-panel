import { useState, useEffect, useMemo } from "react";
import StatsCards from "../../components/dashboard/StatsCards";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function NewOrder() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Fetch real categories and services
  useEffect(() => {
    let isMounted = true;
    const loadCategoriesAndServices = async () => {
      setIsLoadingData(true);
      try {
        const [catRes, srvRes] = await Promise.allSettled([
          api.get("/api/category"),
          api.get("/api/service"),
        ]);

        let loadedCategories = [];
        if (catRes.status === "fulfilled" && catRes.value.data?.categories) {
          loadedCategories = catRes.value.data.categories;
        }

        let loadedServices = [];
        if (srvRes.status === "fulfilled" && srvRes.value.data?.services) {
          loadedServices = srvRes.value.data.services.filter(
            (s) => s.status !== "inactive" && s.status !== "disabled"
          );
        }

        if (isMounted) {
          setCategories(loadedCategories);
          setServices(loadedServices);

          // Combine categories from category API and service records
          const seen = new Set();
          const catNames = [];
          loadedCategories.forEach((c) => {
            if (c && c.status !== "inactive" && c.name && !seen.has(c.name.toLowerCase())) {
              seen.add(c.name.toLowerCase());
              catNames.push(c.name);
            }
          });
          loadedServices.forEach((s) => {
            const cat = s.category || (loadedCategories.find((c) => c._id === s.categoryId)?.name);
            if (cat && !seen.has(cat.toLowerCase())) {
              seen.add(cat.toLowerCase());
              catNames.push(cat);
            }
          });

          const initialCat = catNames[0] || "General";
          setSelectedCategory(initialCat);

          const matchingServices = loadedServices.filter((s) => {
            const sCat = s.category || (loadedCategories.find((c) => c._id === s.categoryId)?.name) || "";
            return sCat.toLowerCase() === initialCat.toLowerCase();
          });
          if (matchingServices.length > 0) {
            setSelectedServiceId(matchingServices[0]._id || matchingServices[0].id || "");
          }
        }
      } catch (err) {
        console.error("Failed to load services or categories:", err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    loadCategoriesAndServices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter services by active category
  const filteredServices = useMemo(() => {
    if (!selectedCategory) return services;
    return services.filter((s) => {
      const sCat = s.category || (categories.find((c) => c._id === s.categoryId)?.name) || "";
      return sCat.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [services, selectedCategory, categories]);

  // Selected Service Details
  const selectedService = useMemo(() => {
    return (
      filteredServices.find(
        (s) => (s._id || s.id) === selectedServiceId
      ) || filteredServices[0] || null
    );
  }, [filteredServices, selectedServiceId]);

  // Auto-select first service when category changes
  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setSelectedCategory(newCat);
    const matches = services.filter((s) => {
      const sCat = s.category || (categories.find((c) => c._id === s.categoryId)?.name) || "";
      return sCat.toLowerCase() === newCat.toLowerCase();
    });
    if (matches.length > 0) {
      setSelectedServiceId(matches[0]._id || matches[0].id || "");
    } else {
      setSelectedServiceId("");
    }
  };

  const handleServiceChange = (e) => {
    setSelectedServiceId(e.target.value);
  };

  // Dynamic Charge Calculation
  const charge = useMemo(() => {
    if (!quantity || !selectedService) return "0.00";
    const rate = Number(selectedService.rate || selectedService.price || 0);
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) return "0.00";
    return ((qty * rate) / 1000).toFixed(2);
  }, [quantity, selectedService]);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmitting) return;

    setStatusMessage(null);

    if (!selectedService) {
      setStatusMessage({ type: "error", text: "Please select a valid service." });
      return;
    }

    const cleanLink = link.trim();
    if (!cleanLink) {
      setStatusMessage({ type: "error", text: "Please provide a valid destination link." });
      return;
    }

    const numQuantity = Number(quantity);
    if (!numQuantity || isNaN(numQuantity) || numQuantity <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid order quantity." });
      return;
    }

    const minQty = Number(selectedService.min || 1);
    const maxQty = Number(selectedService.max || 1000000);

    if (numQuantity < minQty) {
      setStatusMessage({
        type: "error",
        text: `Minimum quantity for this service is ${minQty.toLocaleString()}.`,
      });
      return;
    }

    if (numQuantity > maxQty) {
      setStatusMessage({
        type: "error",
        text: `Maximum quantity for this service is ${maxQty.toLocaleString()}.`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        serviceId: selectedService._id || selectedService.id,
        service: selectedService.name,
        category: selectedCategory,
        link: cleanLink,
        quantity: numQuantity,
        charge: Number(charge),
      };

      const res = await api.post("/api/order", payload);
      const data = res.data;

      if (data?.success) {
        const orderId = data.order?.orderId || data.order?._id || "New";
        setStatusMessage({
          type: "success",
          text: `Order #${orderId} placed successfully for ₹${charge}!`,
        });
        setLink("");
        setQuantity("");
      } else {
        setStatusMessage({
          type: "error",
          text: data?.message || "Failed to submit order. Please try again.",
        });
      }
    } catch (err) {
      console.error("Order Submission Error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      let msg = "Failed to submit order.";
      if (backendMessage && typeof backendMessage === "string") {
        msg = backendMessage.trim();
      } else if (err?.status === 403) {
        msg = "Order submission is currently restricted on this server (Admin authorization required).";
      } else if (err?.status === 400) {
        msg = "Invalid order parameters. Please check your link and quantity.";
      } else if (!err?.isBackendAvailable) {
        msg = "Unable to connect to order server. Please check your network.";
      }

      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unique Category List (combines active categories and service references)
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

  return (
    <DashboardLayout>
      {/* Page Heading */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        New Order
      </h1>

      {/* Stats */}
      <StatsCards />

      {/* Order Form */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 lg:p-8">

        {statusMessage && (
          <div
            className={`p-4 rounded-lg mb-6 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {isLoadingData ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            Loading services and categories from server...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Category */}
            <div className="mb-5">
              <label className="font-medium text-gray-700">
                Category
              </label>

              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2 sm:p-3 mt-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
              >
                {categoryOptions.length > 0 ? (
                  categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                ) : (
                  <option value="General">General</option>
                )}
              </select>
            </div>

            {/* Service */}
            <div className="mb-5">
              <label className="font-medium text-gray-700">
                Service
              </label>

              <select
                value={selectedService?._id || selectedService?.id || ""}
                onChange={handleServiceChange}
                className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg p-2 sm:p-3 mt-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
              >
                {filteredServices.length > 0 ? (
                  filteredServices.map((item) => (
                    <option key={item._id || item.id} value={item._id || item.id}>
                      {item.name} — ₹{item.rate || item.price || 0} / 1K
                    </option>
                  ))
                ) : (
                  <option value="">No active services in this category</option>
                )}
              </select>
            </div>

            {selectedService && (
              <>
                {/* Rate / Min / Max */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label className="text-gray-700 text-sm font-medium">Rate</label>
                    <input
                      value={`₹${selectedService.rate || selectedService.price || 0} / 1000`}
                      readOnly
                      className="w-full border rounded-lg p-3 mt-2 bg-gray-100 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 text-sm font-medium">Min</label>
                    <input
                      value={selectedService.min || 1}
                      readOnly
                      className="w-full border rounded-lg p-3 mt-2 bg-gray-100 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-gray-700 text-sm font-medium">Max</label>
                    <input
                      value={selectedService.max ? selectedService.max.toLocaleString() : "100,000"}
                      readOnly
                      className="w-full border rounded-lg p-3 mt-2 bg-gray-100 text-sm"
                    />
                  </div>
                </div>

                {/* Average Time */}
                <div className="mb-5">
                  <label className="text-gray-700 text-sm font-medium">Average Time</label>
                  <input
                    value={selectedService.averageTime || selectedService.deliveryTime || "Instant to 1 Hour"}
                    readOnly
                    className="w-full border rounded-lg p-3 mt-2 bg-gray-100 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="mb-5">
                  <label className="text-gray-700 text-sm font-medium">Description</label>
                  <textarea
                    rows="3"
                    value={selectedService.description || "High-quality fast delivery social media marketing service."}
                    readOnly
                    className="w-full border rounded-lg p-3 mt-2 bg-gray-100 resize-none text-sm"
                  />
                </div>
              </>
            )}

            {/* Link */}
            <div className="mb-5">
              <label className="text-gray-700 text-sm font-medium">Link</label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                required
                className="w-full border rounded-lg p-3 mt-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Quantity */}
            <div className="mb-5">
              <label className="text-gray-700 text-sm font-medium">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter Quantity"
                min={selectedService?.min || 1}
                max={selectedService?.max || 1000000}
                required
                className="w-full border rounded-lg p-3 mt-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Charge */}
            <div className="mb-6">
              <label className="text-gray-700 text-sm font-medium">Charge</label>
              <input
                value={`₹${charge}`}
                readOnly
                className="w-full border rounded-lg p-3 mt-2 bg-gray-100 font-semibold text-gray-800 text-sm"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedService}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting Order..." : "Submit Order"}
            </button>
          </form>
        )}

      </div>
    </DashboardLayout>
  );
}

export default NewOrder;
