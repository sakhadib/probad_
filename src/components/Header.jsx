import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase/config';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { BarChart3, LogOut, LogIn, UserPlus, Menu, X, Layers, Brain, List } from 'lucide-react';

const Header = () => {
  const [user] = useAuthState(auth);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  // Don't show header on auth pages
  if (location.pathname === '/signup' || location.pathname === '/login') {
    return null;
  }

  const navItems = user
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
        { to: '/evaluation-dashboard', label: 'Evaluation', icon: Brain },
        { to: '/manage-evaluation', label: 'Manage Eval', icon: List },
        { to: '/review', label: 'Review Queue', icon: Layers }
      ]
    : [];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 font-hind-siliguri">
      <div className="relative bg-slate-950/70 backdrop-blur border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-slate-900/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              to="/"
              className="text-2xl font-semibold tracking-tight text-white hover:text-indigo-200 transition-colors"
              onClick={closeMobile}
            >
              probad_
            </Link>

            {user && (
              <nav className="hidden md:flex items-center gap-2">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={closeMobile}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive(to)
                        ? 'bg-indigo-500/80 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={() => {
                    closeMobile();
                    handleSignOut();
                  }}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white hover:bg-white/10"
                  >
                    <LogIn size={16} />
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                  >
                    <UserPlus size={16} />
                    Sign Up
                  </Link>
                </div>
              )}

              <button
                className="inline-flex md:hidden items-center justify-center rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={`md:hidden transition-[max-height] duration-300 ease-in-out overflow-hidden ${
            mobileOpen ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="space-y-4 border-t border-white/10 bg-slate-950/80 px-4 pb-6 pt-4 text-sm text-gray-200">
            {user ? (
              <div className="space-y-2">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 transition ${
                      isActive(to) ? 'bg-indigo-500/70 text-white' : 'hover:bg-white/10'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-gray-200 transition hover:bg-white/20"
                >
                  <LogIn size={18} />
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMobile}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500/80 px-4 py-3 text-white transition hover:bg-indigo-400"
                >
                  <UserPlus size={18} />
                  Create Account
                </Link>
              </div>
            )}

            {user && (
              <button
                onClick={() => {
                  closeMobile();
                  handleSignOut();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-gray-200 transition hover:bg-white/20"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;