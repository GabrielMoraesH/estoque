function PageHeader({ title, subtitle, level = 2, className = "" }) {
  const Heading = `h${level}`;

  return (
    <div className={`page-header${className ? ` ${className}` : ""}`}>
      <Heading className="page-title">{title}</Heading>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}

export default PageHeader;
