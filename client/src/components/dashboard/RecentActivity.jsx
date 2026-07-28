import {
  FaShoppingCart,
  FaWallet,
  FaTicketAlt,
  FaCheckCircle,
} from "react-icons/fa";

const activities = [
  {
    id: 1,
    title: "New Order Placed",
    description: "Instagram Followers - 1000",
    time: "5 min ago",
    icon: <FaShoppingCart className="text-blue-600" />,
  },
  {
    id: 2,
    title: "Wallet Recharged",
    description: "₹500 Added Successfully",
    time: "20 min ago",
    icon: <FaWallet className="text-green-600" />,
  },
  {
    id: 3,
    title: "Support Ticket Created",
    description: "Payment Issue",
    time: "1 hour ago",
    icon: <FaTicketAlt className="text-orange-600" />,
  },
  {
    id: 4,
    title: "Order Completed",
    description: "YouTube Views Delivered",
    time: "3 hours ago",
    icon: <FaCheckCircle className="text-purple-600" />,
  },
];

function RecentActivity() {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">

      <h2 className="text-xl font-semibold mb-6">
        Recent Activity
      </h2>

      <div className="space-y-5">

        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-4 border-b pb-4"
          >
            <div className="bg-gray-100 p-3 rounded-full">
              {activity.icon}
            </div>

            <div className="flex-1">
              <h3 className="font-semibold">
                {activity.title}
              </h3>

              <p className="text-gray-500 text-sm">
                {activity.description}
              </p>
            </div>

            <span className="text-sm text-gray-400">
              {activity.time}
            </span>
          </div>
        ))}

      </div>

    </div>
  );
}

export default RecentActivity;