export function Loader({ size = "md", color = "text-blue-600", className = "" }) {
  const sizes = {
    xs: "w-4 h-4 border-2",
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
    xl: "w-16 h-16 border-4",
  };

  const sizeClass = sizes[size] || sizes.md;

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-solid border-gray-200 border-t-current ${color} ${sizeClass}`}
        role="status"
        aria-label="loading"
      />
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageLoader({ message = "Loading data..." }) {
  return (
    <div className="min-h-[300px] w-full flex flex-col items-center justify-center py-12">
      <Loader size="lg" />
      {message && <p className="mt-4 text-sm text-gray-500 font-medium">{message}</p>}
    </div>
  );
}

export default Loader;
