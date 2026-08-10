import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/layout.css";

function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;

    if (open) {
      body.style.overflow = "hidden";
      body.classList.add("mobile-menu-open");
    } else {
      body.classList.remove("mobile-menu-open");
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.classList.remove("mobile-menu-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="layout">
      <button
        className="hamburger"
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen(!open)}
      >
        <span className="hamburger-icon" aria-hidden="true">
          {open ? "\u00d7" : "\u2630"}
        </span>
        <span className="hamburger-label">{open ? "Fechar" : "Menu"}</span>
      </button>

      {open && (
        <button
          className="sidebar-backdrop open"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div id="app-sidebar" className={open ? "sidebar open" : "sidebar"}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      <div className="content" onClick={() => open && setOpen(false)}>
        {children}
      </div>
    </div>
  );
}

export default Layout;
