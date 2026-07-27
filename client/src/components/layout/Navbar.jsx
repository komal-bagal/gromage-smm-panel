import { FaBell, FaUserCircle } from "react-icons/fa";
import { useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  const titles = {
    "/dashboard": "Dashboard",
    "/orders": "Orders",
    "/services": "Services",
    "/wallet": "Wallet",
    "/profile": "Profile",
    "/settings": "Settings",
  };

  return (
    <header className="bg-white h-16 shadow flex items-center justify-between px-6">

      <h2 className="text-xl font-semibold">
        {titles[location.pathname] || "Gromage SMM Panel"}
      </h2>

      <div className="flex items-center gap-6">

        <button className="text-2xl text-gray-600 hover:text-blue-600">
          <FaBell />
        </button>

        <div className="flex items-center gap-2 cursor-pointer">
          <FaUserCircle className="text-3xl text-gray-700" />
          <span className="font-medium">Admin</span>
        </div>

      </div>

    </header>
  );
}

export default Navbar;