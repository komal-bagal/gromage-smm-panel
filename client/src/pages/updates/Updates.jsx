import DashboardLayout from "../../components/layout/DashboardLayout";

function Updates() {
  const updates = [
    {
      id: 1,
      title: "Instagram Followers Service Improved",
      date: "28 Jul 2026",
      type: "Feature",
      description:
        "Our Instagram Followers service is now faster and more stable.",
    },
    {
      id: 2,
      title: "Scheduled Maintenance",
      date: "25 Jul 2026",
      type: "Maintenance",
      description:
        "The system will be under maintenance from 2 AM to 4 AM.",
    },
    {
      id: 3,
      title: "New YouTube Services Added",
      date: "20 Jul 2026",
      type: "Announcement",
      description:
        "New YouTube Watch Time and Shorts Views services are now available.",
    },
  ];

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Latest Updates
      </h1>

      <div className="space-y-4 sm:space-y-6">
        {updates.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow p-4 sm:p-6"
          >
            {/* Title and Date */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                {item.title}
              </h2>

              <span className="text-sm text-gray-500 whitespace-nowrap">
                {item.date}
              </span>
            </div>

            {/* Update Type */}
            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs sm:text-sm mb-3 sm:mb-4">
              {item.type}
            </span>

            {/* Description */}
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

export default Updates;