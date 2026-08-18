import { cloneElement, isValidElement, useId } from "react";

function FormField({ label, htmlFor, required = false, description, error, children, className = "" }) {
  const generatedId = useId();
  const descriptionId = description ? `${htmlFor || generatedId}-description` : undefined;
  const errorId = error ? `${htmlFor || generatedId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
      "aria-describedby": children.props["aria-describedby"] || describedBy,
      "aria-invalid": error ? true : children.props["aria-invalid"]
    })
    : children;

  return (
    <div className={`form-field field-group${className ? ` ${className}` : ""}`}>
      <label htmlFor={htmlFor}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {control}
      {description && <small id={descriptionId} className="form-field-description">{description}</small>}
      {error && <p id={errorId} className="form-field-error">{error}</p>}
    </div>
  );
}

export default FormField;
