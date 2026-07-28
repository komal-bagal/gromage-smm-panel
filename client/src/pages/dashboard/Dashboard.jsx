import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import RecentOrders from "../../components/dashboard/RecentOrders";
import OrdersChart from "../../components/dashboard/OrdersChart";
import WalletSummary from "../../components/dashboard/WalletSummary";
import TopServices from "../../components/dashboard/TopServices";
import QuickActions from "../../components/dashboard/QuickActions";
import RecentActivity from "../../components/dashboard/RecentActivity";

import {
  FaShoppingCart,
  FaWallet,
  FaUsers,
  FaServicestack,
} from "react-icons/fa";

function Dashboard() {
  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-8">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <Card
          title="Total Orders"
          value="152"
          icon={<FaShoppingCart />}
        />

        <Card
          title="Active Services"
          value="45"
          icon={<FaServicestack />}
        />

        <Card
          title="Wallet Balance"
          value="₹12,500"
          icon={<FaWallet />}
        />

        <Card
          title="Total Users"
          value="320"
          icon={<FaUsers />}
        />

      </div>

      {/* Orders Chart */}

      <div className="mt-8">
        <OrdersChart />
      </div>

      <div className="mt-8">
        <WalletSummary />
      </div>

      <div className="mt-8">
        <TopServices />
      </div>

      <div className="mt-8">
        <QuickActions />
      </div>

      <div className="mt-8">
        <RecentActivity />
      </div>

      {/* Recent Orders */}

      <RecentOrders />
    </DashboardLayout>
  );
}

export default Dashboard;