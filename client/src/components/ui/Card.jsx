function Card({ title, value, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition duration-300 p-6 flex justify-between items-center border border-gray-100">

      <div>
        <p className="text-gray-500 text-sm font-medium">
          {title}
        </p>

        <h2 className="text-3xl font-bold mt-2 text-gray-800">
          {value}
        </h2>
      </div>

      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-xl text-blue-600">
      {icon}
    </div>

    </div >
  );
}

export default Card;