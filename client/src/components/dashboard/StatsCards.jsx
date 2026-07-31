import Card from "../ui/Card";

import {
  FaUser,
  FaMoneyBillWave,
  FaShoppingCart,
  FaWallet,
} from "react-icons/fa";

function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

      <Card  title="Welcome 👋" value="Admin" icon={<FaUser />} />

      <Card title="Spent Balance" value="₹7,998.10" icon={<FaMoneyBillWave />} />

      <Card title="Panel Orders" value="152" icon={<FaShoppingCart />} />

      <Card title="Account Balance" value="₹12,500" icon={<FaWallet />} />

    </div>
  );
}

export default StatsCards;