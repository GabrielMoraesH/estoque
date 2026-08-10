import SectionHeader from "./SectionHeader";

function Panel({
  children,
  title,
  subtitle,
  actions,
  className = "",
  headerClassName = "",
  as: Component = "div"
}) {
  return (
    <Component className={`panel-card${className ? ` ${className}` : ""}`}>
      {(title || subtitle || actions) && (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          className={headerClassName}
        />
      )}

      {children}
    </Component>
  );
}

export default Panel;
