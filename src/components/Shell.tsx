import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useSave } from "../save/SaveProvider";
import { hasStarted } from "../save/progress";

function StorageBanner() {
  const { storageOk, readStatus } = useSave();
  if (!storageOk) {
    return (
      <div className="banner banner-warn" role="alert">
        <strong>Saving is off.</strong>
        <span>This browser is blocking storage, so progress won't survive a reload. Export your save now.</span>
        <Link className="btn" to="/settings">Export save</Link>
      </div>
    );
  }
  if (readStatus === "corrupt") {
    return (
      <div className="banner banner-warn" role="alert">
        <strong>Your old save couldn't be read.</strong>
        <span>A backup copy was kept in this browser. If you have an exported save file, import it in Settings.</span>
      </div>
    );
  }
  return null;
}

export function Shell() {
  const { save, flush } = useSave();
  const location = useLocation();

  // Persist before moving between screens (invariant 1), and start each screen at the top.
  useEffect(() => {
    flush();
    window.scrollTo(0, 0);
  }, [location.pathname, flush]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reducedMotion = String(save.settings.reducedMotion);
    root.dataset.fontSize = save.settings.fontSize;
  }, [save.settings]);

  const showMap = hasStarted(save);

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">
          REBOOT<span>_</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {showMap && <NavLink to="/map">Station</NavLink>}
          <NavLink to="/vault">Vault</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <StorageBanner />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
