import { useState } from "react";
import StatsCards from "../../components/dashboard/StatsCards";
import DashboardLayout from "../../components/layout/DashboardLayout";
import services from "../../data/services";

function NewOrder() {
  const [category, setCategory] = useState("Instagram");

  const filteredServices = services.filter(
    (item) => item.category === category
  );

  const [selectedService, setSelectedService] = useState(filteredServices[0]);

  const [quantity, setQuantity] = useState("");

  const charge =
  quantity && selectedService
    ? (Number(quantity) * Number(selectedService.rate) / 1000).toFixed(2)
    : "0.00";

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategory(value);

    const filtered = services.filter(
      (item) => item.category === value
    );

    setSelectedService(filtered[0]);
  };

  const handleServiceChange = (e) => {
    const service = services.find(
      (item) => item.id === Number(e.target.value)
    );

    setSelectedService(service);
  };

  const handleSubmit = () => {
    alert("Order Submitted Successfully!");
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">
        New Order
      </h1>

      <StatsCards />

      <div className="bg-white rounded-xl shadow p-8">

        {/* Category */}

        <div className="mb-5">

          <label className="font-medium">
            Category
          </label>

          <select
            value={category}
            onChange={handleCategoryChange}
            className="w-full border rounded-lg p-3 mt-2"
          >
            <option>Instagram</option>
            <option>YouTube</option>
            <option>Facebook</option>
          </select>

        </div>

        {/* Service */}

        <div className="mb-5">

          <label className="font-medium">
            Service
          </label>

          <select
            value={selectedService.id}
            onChange={handleServiceChange}
            className="w-full border rounded-lg p-3 mt-2"
          >
            {filteredServices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

        </div>

        {/* Rate Min Max */}

        <div className="grid md:grid-cols-3 gap-4 mb-5">

          <div>

            <label>Rate</label>

            <input
  value={`₹${selectedService.rate} / 1000`}
  readOnly
  className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
/>
          </div>

          <div>

            <label>Min</label>

            <input
              value={selectedService.min}
              readOnly
              className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
            />

          </div>

          <div>

            <label>Max</label>

            <input
              value={selectedService.max}
              readOnly
              className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
            />

          </div>

        </div>

        {/* Average Time */}

        <div className="mb-5">

          <label>Average Time</label>

          <input
            value={selectedService.averageTime}
            readOnly
            className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
          />

        </div>

        {/* Description */}

        <div className="mb-5">

          <label>Description</label>

          <textarea
            rows="4"
            value={selectedService.description}
            readOnly
            className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
          />

        </div>

        {/* Link */}

        <div className="mb-5">

          <label>Link</label>

          <input
            type="text"
            placeholder="Paste Link"
            className="w-full border rounded-lg p-3 mt-2"
          />

        </div>

        {/* Quantity */}

        <div className="mb-5">

          <label>Quantity</label>

          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter Quantity"
            className="w-full border rounded-lg p-3 mt-2"
          />

        </div>

        <div className="mb-6">

          <label>Charge</label>

          <input
            value={`₹${charge}`}
            readOnly
            className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
          />

        </div>

        <button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg"
        >
          Submit Order
        </button>

      </div>

    </DashboardLayout>
  );
}

export default NewOrder;