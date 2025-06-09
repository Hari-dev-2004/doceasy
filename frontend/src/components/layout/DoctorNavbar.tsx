import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoreVertical, Home, LogOut, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DoctorNavbarProps {
  onHomeClick: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

const DoctorNavbar = ({ onHomeClick, onLogout, isLoggingOut }: DoctorNavbarProps) => {
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

          {/* Three-dotted Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onHomeClick} className="flex items-center">
                <Home className="h-4 w-4 mr-2" />
                Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout} className="flex items-center text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
                {isLoggingOut && <Loader2 className="h-3 w-3 ml-2 animate-spin" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default DoctorNavbar; 