
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-50 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center mb-4">
              <span className="text-2xl font-heading font-bold text-medical-blue">
                Easy<span className="text-medical-teal">Doc</span>
              </span>
            </div>
            <p className="text-gray-600 mb-4">
              Connecting patients with healthcare professionals through seamless
              online video consultations.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-600 hover:text-medical-blue transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Doctors
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* For Patients & Doctors */}
          <div>
            <h3 className="text-lg font-semibold mb-4">For Users</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/login/patient" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Patient Login
                </Link>
              </li>
              <li>
                <Link to="/login/doctor" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Doctor Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/forgot-password" className="text-gray-600 hover:text-medical-blue transition-colors">
                  Forgot Password
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-600 hover:text-medical-blue transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin size={18} className="text-medical-blue mr-2 mt-0.5" />
                <span className="text-gray-600">
                  123 Healthcare Avenue, Medical District, City
                </span>
              </li>
              <li className="flex items-center">
                <Phone size={18} className="text-medical-blue mr-2" />
                <span className="text-gray-600">+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center">
                <Mail size={18} className="text-medical-blue mr-2" />
                <span className="text-gray-600">contact@easydoc.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} EasyDoc. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="text-gray-500 hover:text-medical-blue text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-500 hover:text-medical-blue text-sm transition-colors">
                Terms of Service
              </Link>
              <Link to="/support" className="text-gray-500 hover:text-medical-blue text-sm transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
