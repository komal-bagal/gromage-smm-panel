import {
  FaInstagram,
  FaYoutube,
  FaFacebook,
} from "react-icons/fa";

const services = [
  {
    name: "Instagram Followers",
    orders: 520,
    icon: <FaInstagram className="text-pink-600 text-2xl" />,
  },
  {
    name: "Instagram Likes",
    orders: 410,
    icon: <FaInstagram className="text-pink-600 text-2xl" />,
  },
  {
    name: "YouTube Views",
    orders: 320,
    icon: <FaYoutube className="text-red-600 text-2xl" />,
  },
  {
    name: "Facebook Likes",
    orders: 210,
    icon: <FaFacebook className="text-blue-600 text-2xl" />,
  },
];

function TopServices() {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">

      <h2 className="text-xl font-semibold mb-6">
        Top Services
      </h2>

      <div className="space-y-4">

        {services.map((service, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b pb-3"
          >
            <div className="flex items-center gap-4">
              {service.icon}

              <div>
                <h3 className="font-semibold">
                  {service.name}
                </h3>

                <p className="text-gray-500 text-sm">
                  {service.orders} Orders
                </p>
              </div>
            </div>

            <span className="text-blue-600 font-semibold">
              #{index + 1}
            </span>
          </div>
        ))}

      </div>

    </div>
  );
}

export default TopServices;