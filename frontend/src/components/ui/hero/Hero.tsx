import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { doctorService } from "@/services/doctorService";

const Hero = () => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const { exactMatch, doctors } = await doctorService.searchDoctors(searchTerm, searchType);
      
      // If we have an exact match by name, redirect to the doctor's profile
      if (exactMatch && (searchType === 'name' || searchType === 'all')) {
        navigate(`/doctor/${exactMatch.id}`);
        return;
      }
      
      // If we have doctors matching the specialty, go to the filtered list
      if (doctors.length > 0) {
        navigate(`/doctors?search=${encodeURIComponent(searchTerm)}&type=${searchType}`);
        return;
      }
      
      // If no matches, still go to doctors page with the search parameters
      navigate(`/doctors?search=${encodeURIComponent(searchTerm)}&type=${searchType}`);
    } catch (error) {
      console.error('Error searching doctors:', error);
      // On error, just navigate to the doctors page with search params
      navigate(`/doctors?search=${encodeURIComponent(searchTerm)}&type=${searchType}`);
    } finally {
      setIsSearching(false);
    }
  };
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-white to-blue-50/60 py-16 md:py-20 lg:py-28">
      {/* Background Pattern */}
      <div className="hidden sm:block absolute top-0 right-0 -mt-16 -mr-16">
        <svg width="404" height="384" fill="none" viewBox="0 0 404 384">
          <defs>
            <pattern id="pattern-circles" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="3" className="text-medical-blue opacity-10" />
            </pattern>
          </defs>
          <rect width="404" height="384" fill="url(#pattern-circles)" />
        </svg>
      </div>
      
      <div className="container mx-auto px-4">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Hero Content */}
          <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
              <span className="block xl:inline">Healthcare From The</span>{" "}
              <span className="block text-medical-blue xl:inline">Comfort Of Your Home</span>
            </h1>
            <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
              Connect with licensed doctors via secure video consultations. Get medical advice, prescriptions, and follow-ups - all online, on your schedule.
            </p>
            
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto bg-medical-blue hover:bg-medical-blue-dark text-base px-8 py-6">
                  Patient Sign Up
                </Button>
              </Link>
              <Link to="/doctor-registration">
                <Button size="lg" className="w-full sm:w-auto bg-medical-teal hover:bg-medical-teal/90 text-base px-8 py-6">
                  Doctor Sign Up
                </Button>
              </Link>
              {/* <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto text-medical-blue border-medical-blue hover:bg-medical-blue/5 text-base px-8 py-6"
                onClick={() => setShowSearch(prev => !prev)}
              >
                Find Doctors
              </Button> */}
            </div>

            {/* Search Box */}
            {showSearch && (
              <div className="mt-6 transition-all duration-300 ease-in-out">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    type="text"
                    placeholder="Search for doctors by name or specialty..."
                    className="pl-10 py-6 pr-24 text-base rounded-md border-medical-blue/30 focus:border-medical-blue focus:ring-medical-blue"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchTerm.trim() && !isSearching) {
                        handleSearch();
                      }
                    }}
                  />
                  <Button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-medical-blue hover:bg-medical-blue-dark"
                    onClick={handleSearch}
                    disabled={!searchTerm.trim() || isSearching}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>
                
                <div className="mt-3">
                  <RadioGroup 
                    defaultValue="all" 
                    value={searchType} 
                    onValueChange={setSearchType}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="text-sm font-medium cursor-pointer">All</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="name" id="name" />
                      <Label htmlFor="name" className="text-sm font-medium cursor-pointer">Doctor Name</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specialty" id="specialty" />
                      <Label htmlFor="specialty" className="text-sm font-medium cursor-pointer">Specialty</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <p className="mt-2 text-sm text-gray-500">
                  Try searching for specialties like "Cardiology", "Pediatrics", or doctor names
                </p>
              </div>
            )}
            
            {/* Trust Elements */}
            <div className="mt-8 border-t border-gray-200 pt-5">
              <p className="text-sm font-medium text-gray-500 mb-4">Trusted by thousands of patients</p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-6">
                <div className="flex items-center">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="inline-block h-8 w-8 rounded-full bg-gray-200 border-2 border-white">
                        <span className="sr-only">User Avatar</span>
                      </div>
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-500">5,000+ Consultations</span>
                </div>
                <div className="flex items-center">
                  <div className="text-yellow-400 flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-500">4.9 Star Rating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
            <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
              <div className="relative block w-full bg-white rounded-lg overflow-hidden">
                <img
                  className="w-full"
                  src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"
                  alt="Doctor consulting with patient online"
                />
                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                  <button
                    type="button"
                    className="bg-medical-blue/80 backdrop-blur-sm rounded-full p-4 text-white hover:bg-medical-blue transition-colors flex items-center justify-center"
                  >
                    <svg className="h-6 w-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="sr-only">Watch our video</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
