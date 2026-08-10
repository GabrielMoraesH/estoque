function TableContainer({ children, className = "" }) {
  return (
    <div className={`table-container${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export default TableContainer;
