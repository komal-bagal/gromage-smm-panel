import DashboardLayout from "../../components/layout/DashboardLayout";

function Settings() {
  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Settings
      </h1>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 lg:p-8 max-w-4xl">

        {/* Theme */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            Theme
          </h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm sm:text-base">
              <input type="radio" name="theme" defaultChecked />
              Light
            </label>

            <label className="flex items-center gap-2 text-sm sm:text-base">
              <input type="radio" name="theme" />
              Dark
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            Notifications
          </h2>

          <label className="flex items-center gap-2 mb-3 text-sm sm:text-base">
            <input type="checkbox" defaultChecked />
            Email Notifications
          </label>

          <label className="flex items-center gap-2 text-sm sm:text-base">
            <input type="checkbox" defaultChecked />
            SMS Notifications
          </label>
        </div>

        {/* Language */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            Language
          </h2>

          <select className="border rounded-lg p-2 sm:p-3 text-sm sm:text-base w-full outline-none focus:ring-2 focus:ring-blue-500">
            <option>English</option>
            <option>Hindi</option>
            <option>Marathi</option>
          </select>
        </div>

        {/* Security */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            Security
          </h2>

          <button className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-lg transition">
            Change Password
          </button>
        </div>

        {/* Save Button */}
        <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
          Save Settings
        </button>

      </div>
    </DashboardLayout>
  );
}

export default Settings;