function SectionHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`section-header${className ? ` ${className}` : ""}`}>
      <div className="section-header-content">
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>

      {actions && <div className="section-header-actions">{actions}</div>}
    </div>
  );
}

export default SectionHeader;
