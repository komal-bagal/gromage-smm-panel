import { Link } from "react-router-dom";
import {
  FaPlusCircle,
  FaWallet,
  FaTicketAlt,
  FaShoppingCart,
} from "react-icons/fa";

function QuickActions() {
  const actions = [
    {
      title: "New Order",
      icon: <FaPlusCircle className="text-3xl text-blue-600" />,
      link: "/new-order",
      color: "bg-blue-50",
    },
    {
      title: "Add Funds",
      icon: <FaWallet className="text-3xl text-green-600" />,
      link: "/wallet",
      color: "bg-green-50",
    },
    {
      title: "Orders",
      icon: <FaShoppingCart className="text-3xl text-purple-600" />,
      link: "/orders",
      color: "bg-purple-50",
    },
    {
      title: "Tickets",
      icon: <FaTicketAlt className="text-3xl text-orange-600" />,
      link: "/tickets",
      color: "bg-orange-50",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">

      <h2 className="text-xl font-semibold mb-6">
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

        {actions.map((action, index) => (
          <Link
            key={index}
            to={action.link}
            className={`${action.color} rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300`}
          >
            <div className="flex justify-center mb-3">
              {action.icon}
            </div>

            <p className="font-semibold">
              {action.title}
            </p>
          </Link>
        ))}

      </div>

    </div>
  );
}

export default QuickActions;