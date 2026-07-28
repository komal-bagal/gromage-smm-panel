import {
  FaWallet,
  FaShoppingCart,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";

function WalletSummary() {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">

      <h2 className="text-xl font-semibold mb-6">
        Wallet Summary
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">

        <div className="bg-blue-50 rounded-lg p-5">
          <FaWallet className="text-blue-600 text-3xl mb-3" />
          <p className="text-gray-500">Current Balance</p>
          <h3 className="text-2xl font-bold">₹12,500</h3>
        </div>

        <div className="bg-green-50 rounded-lg p-5">
          <FaShoppingCart className="text-green-600 text-3xl mb-3" />
          <p className="text-gray-500">Today's Orders</p>
          <h3 className="text-2xl font-bold">18</h3>
        </div>

        <div className="bg-yellow-50 rounded-lg p-5">
          <FaClock className="text-yellow-600 text-3xl mb-3" />
          <p className="text-gray-500">Pending Orders</p>
          <h3 className="text-2xl font-bold">5</h3>
        </div>

        <div className="bg-purple-50 rounded-lg p-5">
          <FaCheckCircle className="text-purple-600 text-3xl mb-3" />
          <p className="text-gray-500">Completed Orders</p>
          <h3 className="text-2xl font-bold">146</h3>
        </div>

      </div>

    </div>
  );
}

export default WalletSummary;