import DashboardLayout from "../../components/layout/DashboardLayout";

function Settings() {
  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-8">
        Settings
      </h1>

      <div className="bg-white rounded-xl shadow p-8 max-w-4xl">

        {/* Theme */}

        <div className="mb-8">

          <h2 className="text-xl font-semibold mb-4">
            Theme
          </h2>

          <div className="space-y-2">

            <label className="flex items-center gap-2">
              <input type="radio" name="theme" defaultChecked />
              Light
            </label>

            <label className="flex items-center gap-2">
              <input type="radio" name="theme" />
              Dark
            </label>

          </div>

        </div>

        {/* Notifications */}

        <div className="mb-8">

          <h2 className="text-xl font-semibold mb-4">
            Notifications
          </h2>

          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" defaultChecked />
            Email Notifications
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            SMS Notifications
          </label>

        </div>

        {/* Language */}

        <div className="mb-8">

          <h2 className="text-xl font-semibold mb-4">
            Language
          </h2>

          <select className="border rounded-lg p-3 w-full">

            <option>English</option>
            <option>Hindi</option>
            <option>Marathi</option>

          </select>

        </div>

        {/* Security */}

        <div className="mb-8">

          <h2 className="text-xl font-semibold mb-4">
            Security
          </h2>

          <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-3 rounded-lg">
            Change Password
          </button>

        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
          Save Settings
        </button>

      </div>

    </DashboardLayout>
  );
}

export default Settings;