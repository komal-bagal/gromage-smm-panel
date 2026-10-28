function Card({
  title,
  value,
  icon,
  subtitle,
  children,
  className = "",
  headerAction,
  footer,
  ...props
}) {
  if (children) {
    return (
      <div
        className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}
        {...props}
      >
        {(title || headerAction) && (
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              {title && (
                <h3 className="font-semibold text-gray-900 text-base">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition duration-300 p-6 flex justify-between items-center border border-gray-100 ${className}`}
      {...props}
    >
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <h2 className="text-3xl font-bold mt-2 text-gray-800">{value}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>

      {icon && (
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-xl text-blue-600 shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}

export default Card;