function FilterPanel({ children, className = "", as: Component = "section", ...props }) {
  return <Component {...props} className={`filter-panel${className ? ` ${className}` : ""}`}>{children}</Component>;
}

export default FilterPanel;
