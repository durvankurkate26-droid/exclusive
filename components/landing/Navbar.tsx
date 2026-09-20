type NavbarProps = {
  menuOpen: boolean;
  onMenuClick: () => void;
};

export function Navbar({ menuOpen, onMenuClick }: NavbarProps) {
  return (
    <header className="site-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-[18px] md:px-6">
      <a className="nav-label font-bold" href="#top" aria-label="EXCLUSIVE home">
        EXCLUSIVE
      </a>
      <span className="nav-label absolute left-1/2 -translate-x-1/2 opacity-70">MEMBERS ONLY</span>
      <button
        className="nav-label menu-trigger"
        type="button"
        onClick={onMenuClick}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="kinetic-menu"
      >
        <span className="menu-word-window" aria-hidden="true">
          <span className={menuOpen ? "menu-word is-open" : "menu-word"}>MENU<br />CLOSE</span>
        </span>
        <span aria-hidden="true" className={menuOpen ? "menu-plus is-open" : "menu-plus"}>+</span>
      </button>
    </header>
  );
}
