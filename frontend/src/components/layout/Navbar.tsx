import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, ChevronDown, LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface NavbarProps {
  simplified?: boolean;
}

const Navbar = ({ simplified = false }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isDoctorDashboard = userRole === 'doctor' && location.pathname.includes('/dashboard/doctor');

  useEffect(() => {
    // Check authentication status on component mount and when location changes
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('user_role');
    setIsLoggedIn(!!token);
    setUserRole(role);
  }, [location]);

  // If in simplified mode, only render the logo
  if (simplified) {
    return (
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-xl font-heading font-bold text-medical-blue">
                Easy<span className="text-medical-teal">Doc</span>
              </span>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleDashboardDropdown = () => setIsDashboardDropdownOpen(!isDashboardDropdownOpen);
  const closeMenu = () => setIsMenuOpen(false);
  
  // Handle logout
  const handleLogout = () => {
    setIsLoggingOut(true);
    
    try {
      // Clear all authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      
      // Update state
      setIsLoggedIn(false);
      setUserRole(null);
      
      // Show success message
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Redirect to home page
      navigate('/');
    } catch (err) {
      console.error('Error during logout:', err);
      toast({
        title: "Logout failed",
        description: "There was an issue logging you out. Please try again.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Function to get dashboard link based on user role
  const getDashboardLink = () => {
    switch(userRole) {
      case 'doctor':
        return '/dashboard/doctor';
      case 'admin':
        return '/dashboard/admin';
      default:
        return '/dashboard/patient';
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <span className="text-xl font-heading font-bold text-medical-blue">
              Easy<span className="text-medical-teal">Doc</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!isDoctorDashboard && (
            <div className="hidden md:flex space-x-8">
              <Link
                to="/"
                className="text-gray-700 hover:text-medical-blue transition-colors font-medium"
              >
                Home
              </Link>
              <Link
                to="/about"
                className="text-gray-700 hover:text-medical-blue transition-colors font-medium"
              >
                About
              </Link>
            
              
              <div className="relative" onMouseLeave={() => setIsDashboardDropdownOpen(false)}>
                <button
                  onClick={toggleDashboardDropdown}
                  className="flex items-center space-x-1 text-gray-700 font-medium hover:text-medical-blue transition-colors"
                  onMouseEnter={() => setIsDashboardDropdownOpen(true)}
                >
                  <span>Dashboards</span>
                  <ChevronDown size={16} />
                </button>
                {isDashboardDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 animate-fade-in">
                    <Link
                      to="/dashboard/patient"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDashboardDropdownOpen(false)}
                    >
                      Patient Dashboard
                    </Link>
                    <Link
                      to="/dashboard/doctor"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDashboardDropdownOpen(false)}
                    >
                      Doctor Dashboard
                    </Link>
                    <Link
                      to="/login/admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        setIsDashboardDropdownOpen(false);
                        // If already logged in as admin, go directly to dashboard
                        if (userRole === 'admin') {
                          navigate('/dashboard/admin');
                        }
                      }}
                    >
                      Admin Dashboard
                    </Link>
                  </div>
                )}
              </div>
              <Link
                to="/contact"
                className="text-gray-700 hover:text-medical-blue transition-colors font-medium"
              >
                Contact
              </Link>
            </div>
          )}

          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoggedIn ? (
              <>
                <div className="relative" onMouseLeave={() => setIsDropdownOpen(false)}>
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center space-x-1 text-gray-700 font-medium hover:text-medical-blue transition-colors"
                    onMouseEnter={() => setIsDropdownOpen(true)}
                  >
                    <span>Login</span>
                    <ChevronDown size={16} />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 animate-fade-in">
                      <Link
                        to="/login/patient"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Patient Login
                      </Link>
                      <Link
                        to="/login/doctor"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Doctor Login
                      </Link>
                      <Link
                        to="/login/admin"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Admin Login
                      </Link>
                    </div>
                  )}
                </div>
                <Link to="/register">
                  <Button className="bg-medical-blue hover:bg-medical-blue-dark">
                    Sign Up
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to={getDashboardLink()}>
                  <Button className="bg-medical-blue hover:bg-medical-blue-dark flex items-center gap-2">
                    <User size={16} />
                    <span>My Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  onClick={handleLogout} 
                  disabled={isLoggingOut}
                  className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Navigation Button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="text-gray-600 hover:text-medical-blue focus:outline-none"
            >
              {isMenuOpen ? (
                <X size={24} aria-hidden="true" />
              ) : (
                <Menu size={24} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 animate-fade-in">
          <div className="container px-4 pt-2 pb-4 space-y-1">
            {!isDoctorDashboard && (
              <>
                <Link
                  to="/"
                  className="block py-2 text-gray-700 hover:text-medical-blue"
                  onClick={closeMenu}
                >
                  Home
                </Link>
                <Link
                  to="/about"
                  className="block py-2 text-gray-700 hover:text-medical-blue"
                  onClick={closeMenu}
                >
                  About
                </Link>
               
                <Link
                  to="/doctors"
                  className="block py-2 text-gray-700 hover:text-medical-blue"
                  onClick={closeMenu}
                >
                  Doctors
                </Link>
                <Link
                  to="/contact"
                  className="block py-2 text-gray-700 hover:text-medical-blue"
                  onClick={closeMenu}
                >
                  Contact
                </Link>
                
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <div className="font-medium py-2">Dashboards:</div>
                  <div className="space-y-2">
                    <Link
                      to="/dashboard/patient"
                      className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                      onClick={closeMenu}
                    >
                      Patient Dashboard
                    </Link>
                    <Link
                      to="/dashboard/doctor"
                      className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                      onClick={closeMenu}
                    >
                      Doctor Dashboard
                    </Link>
                    <Link
                      to="/dashboard/admin"
                      className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                      onClick={(e) => {
                        closeMenu();
                        // Check if user is admin before navigating
                        if (userRole !== 'admin') {
                          e.preventDefault();
                          toast({
                            title: "Access Denied",
                            description: "You need admin privileges to access the Admin Dashboard.",
                            variant: "destructive"
                          });
                          // Optionally redirect to login
                          // navigate('/login/admin');
                        }
                      }}
                    >
                      Admin Dashboard
                    </Link>
                  </div>
                </div>
              </>
            )}
            
            {!isLoggedIn ? (
              <div className="pt-2 border-t border-gray-100 mt-2">
                <div className="font-medium py-2">Login as:</div>
                <div className="space-y-2">
                  <Link
                    to="/login/patient"
                    className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    onClick={closeMenu}
                  >
                    Patient Login
                  </Link>
                  <Link
                    to="/login/doctor"
                    className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    onClick={closeMenu}
                  >
                    Doctor Login
                  </Link>
                  <Link
                    to="/login/admin"
                    className="block py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    onClick={closeMenu}
                  >
                    Admin Login
                  </Link>
                </div>
                <div className="mt-4">
                  <Link to="/register" onClick={closeMenu}>
                    <Button className="w-full bg-medical-blue hover:bg-medical-blue-dark">
                      Sign Up
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-100 mt-2">
                <Link 
                  to={getDashboardLink()}
                  onClick={closeMenu}
                >
                  <Button className="w-full bg-medical-blue hover:bg-medical-blue-dark flex items-center justify-center gap-2 mb-2">
                    <User size={16} />
                    <span>My Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  onClick={handleLogout} 
                  disabled={isLoggingOut}
                  className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
