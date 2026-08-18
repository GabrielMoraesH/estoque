function PageHeader({ title, subtitle, level = 1, className = "" }) {
  const Heading = [1, 2, 3, 4, 5, 6].includes(level) ? `h${level}` : "h1";

  return (
    <div className={`page-header${className ? ` ${className}` : ""}`}>
      <Heading className="page-title">{title}</Heading>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}

export default PageHeader;
