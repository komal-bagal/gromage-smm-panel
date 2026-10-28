function Badge({
  children,
  variant,
  status,
  size = "sm",
  className = "",
}) {
  const normalized = (status || variant || children || "").toString().toLowerCase();

  let colorClasses = "bg-gray-100 text-gray-700 border-gray-200";

  if (
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized.includes("active") ||
    normalized.includes("paid") ||
    normalized.includes("approved")
  ) {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (
    normalized.includes("pending") ||
    normalized.includes("await") ||
    normalized.includes("queue")
  ) {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (
    normalized.includes("process") ||
    normalized.includes("progress") ||
    normalized.includes("info")
  ) {
    colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (
    normalized.includes("cancel") ||
    normalized.includes("fail") ||
    normalized.includes("danger") ||
    normalized.includes("suspend") ||
    normalized.includes("reject") ||
    normalized.includes("inactive")
  ) {
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (
    normalized.includes("partial") ||
    normalized.includes("refund")
  ) {
    colorClasses = "bg-purple-50 text-purple-700 border-purple-200";
  }

  const sizes = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2.5 py-0.5",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizes[size] || sizes.sm} ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75" />
      {children || status}
    </span>
  );
}

export default Badge;
