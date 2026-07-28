import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const data = [
  { month: "Jan", orders: 120 },
  { month: "Feb", orders: 180 },
  { month: "Mar", orders: 260 },
  { month: "Apr", orders: 320 },
  { month: "May", orders: 280 },
  { month: "Jun", orders: 420 },
  { month: "Jul", orders: 510 },
];

function OrdersChart() {
  return (
    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-xl font-semibold mb-5">
        Orders Overview
      </h2>

      <div className="h-80">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={data}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="month" />

            <YAxis />

            <Tooltip />

            <Area
              type="monotone"
              dataKey="orders"
              stroke="#2563eb"
              fill="#93c5fd"
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}

export default OrdersChart;