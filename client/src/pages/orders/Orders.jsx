import DashboardLayout from "../../components/layout/DashboardLayout";

function Orders() {
  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-6">
        Orders
      </h1>

      <div className="bg-white rounded-xl shadow p-6">

        <input
          type="text"
          placeholder="Search Order..."
          className="w-full border rounded-lg p-3 mb-6"
        />

        <table className="w-full">

          <thead>

            <tr className="border-b">

              <th className="text-left py-3">Order ID</th>
              <th className="text-left">Service</th>
              <th className="text-left">Quantity</th>
              <th className="text-left">Charge</th>
              <th className="text-left">Status</th>
              <th className="text-left">Date</th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-b">
              <td className="py-3">#1001</td>
              <td>Instagram Followers</td>
              <td>1000</td>
              <td>₹250</td>
              <td className="text-green-600">Completed</td>
              <td>25 Jul</td>
            </tr>

            <tr className="border-b">
              <td className="py-3">#1002</td>
              <td>YouTube Views</td>
              <td>5000</td>
              <td>₹500</td>
              <td className="text-yellow-500">Pending</td>
              <td>24 Jul</td>
            </tr>

            <tr>
              <td className="py-3">#1003</td>
              <td>Facebook Likes</td>
              <td>2000</td>
              <td>₹300</td>
              <td className="text-blue-600">Processing</td>
              <td>23 Jul</td>
            </tr>

          </tbody>

        </table>

      </div>

    </DashboardLayout>
  );
}

export default Orders;