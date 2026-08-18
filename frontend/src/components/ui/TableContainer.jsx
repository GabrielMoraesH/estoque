function TableContainer({ children, className = "" }) {
  return (
    <div className={`table-container table-container-base${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export default TableContainer;
