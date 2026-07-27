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

      <h1 className="text-3xl font-bold mb-8">
        Latest Updates
      </h1>

      <div className="space-y-6">

        {updates.map((item) => (

          <div
            key={item.id}
            className="bg-white rounded-xl shadow p-6"
          >

            <div className="flex justify-between mb-3">

              <h2 className="text-xl font-semibold">
                {item.title}
              </h2>

              <span className="text-sm text-gray-500">
                {item.date}
              </span>

            </div>

            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm mb-4">
              {item.type}
            </span>

            <p className="text-gray-600">
              {item.description}
            </p>

          </div>

        ))}

      </div>

    </DashboardLayout>
  );
}

export default Updates;