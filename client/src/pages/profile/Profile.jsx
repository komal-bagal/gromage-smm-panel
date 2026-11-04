import { useState, useEffect } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function Profile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(authUser || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUser) {
      setProfile(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/user/profile");
        if (res.data?.success && res.data?.user && isMounted) {
          const fetchedUser = res.data.user;
          const authId = authUser?._id || authUser?.id;
          const fetchedId = fetchedUser?._id || fetchedUser?.id;

          if (!authId || !fetchedId || authId === fetchedId || authUser?.email === fetchedUser?.email) {
            setProfile(fetchedUser);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser?.id, authUser?._id, authUser?.email]);

  const activeUser = profile || authUser;
  const memberSince = activeUser?.createdAt
    ? new Date(activeUser.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Active Member";

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-5 sm:mb-8">
        My Profile
      </h1>

      {/* Profile Form */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 lg:p-8 max-w-3xl">
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Loading profile information...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Account Status Badge */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <p className="font-semibold text-gray-800 text-lg">
                  {activeUser?.name || "Customer Account"}
                </p>
                <p className="text-xs text-gray-500">
                  Member since {memberSince}
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full capitalize">
                {activeUser?.status || "Active"}
              </span>
            </div>

            {/* Full Name */}
            <div>
              <label className="block mb-1.5 font-medium text-sm text-gray-700">
                Full Name
              </label>

              <input
                type="text"
                value={activeUser?.name || ""}
                readOnly
                className="w-full border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 text-gray-800 outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block mb-1.5 font-medium text-sm text-gray-700">
                Email Address
              </label>

              <input
                type="email"
                value={activeUser?.email || ""}
                readOnly
                className="w-full border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 text-gray-800 outline-none"
              />
            </div>

            {/* Account Role */}
            <div>
              <label className="block mb-1.5 font-medium text-sm text-gray-700">
                Account Tier
              </label>

              <input
                type="text"
                value={activeUser?.role === "admin" ? "Platform Administrator" : "Standard Customer"}
                readOnly
                className="w-full border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 text-gray-800 outline-none capitalize"
              />
            </div>

            {/* Wallet Balance */}
            <div>
              <label className="block mb-1.5 font-medium text-sm text-gray-700">
                Current Wallet Balance
              </label>

              <input
                type="text"
                value={`₹${Number(activeUser?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                readOnly
                className="w-full border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 font-semibold text-emerald-600 outline-none"
              />
            </div>

            <div className="pt-4 border-t text-xs text-gray-500">
              <p>
                🔒 Account details are verified. To update your registered email or request account changes, please submit a ticket under Support.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Profile;
