import { Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase/config';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { BarChart3, LogOut, LogIn, UserPlus } from 'lucide-react';

const Header = () => {
  const [user] = useAuthState(auth);
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Don't show header on auth pages
  if (location.pathname === '/signup' || location.pathname === '/login') {
    return null;
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 font-hind-siliguri">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition duration-200"
            >
              probad_
            </Link>
          </div>

          {/* Navigation & User Actions */}
          <div className="flex items-center space-x-6">
            {user && (
              <nav className="flex items-center space-x-4">
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition duration-200 ${
                    location.pathname === '/dashboard' 
                      ? 'text-indigo-600 bg-indigo-50' 
                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                  }`}
                >
                  <BarChart3 size={16} />
                  Dashboard
                </Link>
              </nav>
            )}
            
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition duration-200"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition duration-200"
                >
                  <LogIn size={16} />
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition duration-200"
                >
                  <UserPlus size={16} />
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;