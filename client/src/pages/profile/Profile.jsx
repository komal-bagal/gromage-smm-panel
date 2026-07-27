import DashboardLayout from "../../components/layout/DashboardLayout";

function Profile() {
  return (
    <DashboardLayout>

      <h1 className="text-4xl font-bold mb-8">
        My Profile
      </h1>

      <div className="bg-white rounded-xl shadow p-8 max-w-3xl">

        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Full Name
          </label>

          <input
            type="text"
            value="Admin User"
            className="w-full border rounded-lg p-3"
            readOnly
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Email
          </label>

          <input
            type="email"
            value="admin@gromage.com"
            className="w-full border rounded-lg p-3"
            readOnly
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Mobile
          </label>

          <input
            type="text"
            value="+91 9876543210"
            className="w-full border rounded-lg p-3"
            readOnly
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-medium">
            New Password
          </label>

          <input
            type="password"
            placeholder="********"
            className="w-full border rounded-lg p-3"
          />
        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
          Update Profile
        </button>

      </div>

    </DashboardLayout>
  );
}

export default Profile;