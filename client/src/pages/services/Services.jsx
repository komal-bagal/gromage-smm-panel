import DashboardLayout from "../../components/layout/DashboardLayout";

function Services() {
  return (
    <DashboardLayout>

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold">
          Services
        </h1>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg">
          + New Order
        </button>

      </div>

      <div className="bg-white rounded-xl shadow p-6">

        <input
          type="text"
          placeholder="Search Service..."
          className="w-full border rounded-lg p-3 mb-6 outline-none"
        />

        <table className="w-full">

          <thead>
            <tr className="border-b">

              <th className="text-left py-3">Service</th>
              <th className="text-left">Category</th>
              <th className="text-left">Rate</th>
              <th className="text-left">Min</th>
              <th className="text-left">Max</th>

            </tr>
          </thead>

          <tbody>

            <tr className="border-b">

              <td className="py-4">Instagram Followers</td>
              <td>Instagram</td>
              <td>₹0.25</td>
              <td>100</td>
              <td>100000</td>

            </tr>

            <tr className="border-b">

              <td className="py-4">Instagram Likes</td>
              <td>Instagram</td>
              <td>₹0.15</td>
              <td>50</td>
              <td>50000</td>

            </tr>

            <tr className="border-b">

              <td className="py-4">YouTube Views</td>
              <td>YouTube</td>
              <td>₹0.30</td>
              <td>1000</td>
              <td>1000000</td>

            </tr>

            <tr>

              <td className="py-4">Facebook Likes</td>
              <td>Facebook</td>
              <td>₹0.20</td>
              <td>100</td>
              <td>50000</td>

            </tr>

          </tbody>

        </table>

      </div>

    </DashboardLayout>
  );
}

export default Services;