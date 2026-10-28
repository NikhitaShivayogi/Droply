import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function Header({ dark, onThemeToggle }) {
  return (
    <header className="site-header">
      <Brand />
      <nav className="desktop-nav" aria-label="Main navigation">
        <NavLink to="/">Home</NavLink>
        <a href="/#how-it-works">How it works</a>
        <Link to="/privacy">Privacy</Link>
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-toggle" onClick={onThemeToggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link className="button button-dark header-cta" to="/create">Create a Drop <ArrowUpRight size={16} /></Link>
      </div>
    </header>
  );
}
