function Button({ variant = "primary", className = "", type = "button", children, ...props }) {
  return (
    <button
      {...props}
      type={type}
      className={`button button-${variant}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}

export default Button;
