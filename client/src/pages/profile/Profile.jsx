import DashboardLayout from "../../components/layout/DashboardLayout";

function Profile() {
  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-5 sm:mb-8">
        My Profile
      </h1>

      {/* Profile Form */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 lg:p-8 max-w-3xl">

        {/* Full Name */}
        <div className="mb-5 sm:mb-6">
          <label className="block mb-2 font-medium">
            Full Name
          </label>

          <input
            type="text"
            value="Admin User"
            className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base bg-gray-50"
            readOnly
          />
        </div>

        {/* Email */}
        <div className="mb-5 sm:mb-6">
          <label className="block mb-2 font-medium">
            Email
          </label>

          <input
            type="email"
            value="admin@gromage.com"
            className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base bg-gray-50"
            readOnly
          />
        </div>

        {/* Mobile */}
        <div className="mb-5 sm:mb-6">
          <label className="block mb-2 font-medium">
            Mobile
          </label>

          <input
            type="text"
            value="+91 9876543210"
            className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base bg-gray-50"
            readOnly
          />
        </div>

        {/* New Password */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            New Password
          </label>

          <input
            type="password"
            placeholder="Enter new password"
            className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Update Button */}
        <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
          Update Profile
        </button>

      </div>
    </DashboardLayout>
  );
}

export default Profile;