import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">

      <Sidebar />

      <div className="ml-64 flex-1 flex flex-col overflow-hidden">

        <Navbar />

        <main className="bg-gray-100 flex-1 p-8 overflow-y-auto">
          {children}
        </main>

      </div>

    </div>
  );
}

export default DashboardLayout;