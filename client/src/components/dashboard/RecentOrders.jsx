function RecentOrders() {
  const orders = [
    {
      id: "#1001",
      service: "Instagram Followers",
      status: "Completed",
      amount: "₹250",
    },
    {
      id: "#1002",
      service: "YouTube Views",
      status: "Pending",
      amount: "₹500",
    },
    {
      id: "#1003",
      service: "Facebook Likes",
      status: "Processing",
      amount: "₹300",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "text-green-600 font-semibold";
      case "Pending":
        return "text-yellow-500 font-semibold";
      case "Processing":
        return "text-blue-600 font-semibold";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mt-8">
      <h2 className="text-2xl font-bold mb-6">Recent Orders</h2>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-3">Order ID</th>
            <th className="py-3">Service</th>
            <th className="py-3">Status</th>
            <th className="py-3">Amount</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b hover:bg-gray-50">
              <td className="py-3">{order.id}</td>
              <td className="py-3">{order.service}</td>
              <td className={`py-3 ${getStatusColor(order.status)}`}>
                {order.status}
              </td>
              <td className="py-3">{order.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RecentOrders;