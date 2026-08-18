import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap text-xs font-medium transition-colors md:text-sm ${
    isActive ? 'text-blue-500' : 'text-sky-50 hover:text-blue-500'
  }`;

export default function Header() {
  return (
    <header className="bg-navy-950">
      {/* <md: brand row + nav row stacked, both single lines, no wrap.
          md+: unchanged single row, logo left / nav right. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-4 md:py-4">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <img
            src="/logo.webp"
            alt="Comfort Home Quote"
            className="h-7 w-7 shrink-0 md:h-9 md:w-9"
            width={36}
            height={36}
          />
          <span className="truncate font-display text-base font-semibold text-white md:text-lg">
            Comfort Home Quote
          </span>
        </NavLink>
        <nav className="flex items-center gap-4 md:gap-6">
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
