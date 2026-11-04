import { useState, useEffect } from "react";
import Card from "../ui/Card";
import {
  FaUser,
  FaMoneyBillWave,
  FaShoppingCart,
  FaWallet,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function StatsCards() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(authUser || null);
  const [orderCount, setOrderCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (authUser) {
      setProfile(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [profileRes, ordersRes] = await Promise.allSettled([
          api.get("/api/user/profile"),
          api.get("/api/order"),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value.data?.success && isMounted) {
          const fetchedUser = profileRes.value.data.user;
          const authId = authUser?._id || authUser?.id;
          const fetchedId = fetchedUser?._id || fetchedUser?.id;

          if (!authId || !fetchedId || authId === fetchedId || authUser?.email === fetchedUser?.email) {
            setProfile(fetchedUser);
          }
        }

        if (ordersRes.status === "fulfilled" && ordersRes.value.data?.success && isMounted) {
          const orders = ordersRes.value.data.orders || [];
          setOrderCount(orders.length);
          const spent = orders.reduce((sum, o) => sum + (Number(o.charge) || 0), 0);
          setTotalSpent(spent);
        }
      } catch {
        // Fall back gracefully to local state
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [authUser?.id, authUser?._id, authUser?.email]);

  const activeUser = profile || authUser;
  const balance = Number(activeUser?.balance || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      <Card
        title="Welcome 👋"
        value={activeUser?.name || "Customer"}
        icon={<FaUser />}
      />

      <Card
        title="Spent Balance"
        value={`₹${totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={<FaMoneyBillWave />}
      />

      <Card
        title="Panel Orders"
        value={orderCount.toString()}
        icon={<FaShoppingCart />}
      />

      <Card
        title="Account Balance"
        value={`₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={<FaWallet />}
      />
    </div>
  );
}

export default StatsCards;
