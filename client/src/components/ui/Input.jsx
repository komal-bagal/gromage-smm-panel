function Input({
  label,
  error,
  helperText,
  icon = null,
  rightElement = null,
  id,
  name,
  type = "text",
  required = false,
  disabled = false,
  className = "",
  containerClassName = "",
  ...props
}) {
  const inputId = id || name;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative rounded-lg shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          name={name}
          type={type}
          required={required}
          disabled={disabled}
          className={`
            w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition-colors
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
            ${icon ? "pl-9" : ""}
            ${rightElement ? "pr-10" : ""}
            ${
              error
                ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 text-rose-900"
                : "border-gray-300"
            }
            ${className}
          `}
          {...props}
        />

        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
}

export default Input;
