import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-blue-500' : 'text-sky-50 hover:text-blue-500'
  }`;

export default function Header() {
  return (
    <header className="bg-navy-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-2">
          <img src="/logo.webp" alt="Comfort Home Quote" className="h-9 w-9" width={36} height={36} />
          <span className="font-display text-lg font-semibold text-white">Comfort Home Quote</span>
        </NavLink>
        <nav className="flex items-center gap-6">
          <NavLink to="/build" className={navLinkClass}>
            Build My Roof
          </NavLink>
          <NavLink to="/metal" className={navLinkClass}>
            Roofing Options
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
