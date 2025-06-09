import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Loader2, Search, Filter, Calendar } from "lucide-react";
import { doctorService, Doctor } from "@/services/doctorService";

const FindDoctors = () => {
  const location = useLocation();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [specialty, setSpecialty] = useState("");
  
  // List of specialties for filtering
  const specialties = [
    "General Medicine",
    "Pediatrics",
    "Cardiology",
    "Dermatology",
    "Neurology",
    "Orthopedics",
    "Gynecology",
    "Ophthalmology",
    "Psychiatry",
    "Radiology",
    "Urology",
    "Endocrinology",
    "Oncology",
    "Gastroenterology",
    "Pulmonology",
  ];
  
  // Parse search params from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search');
    const typeQuery = searchParams.get('type');
    
    if (searchQuery) {
      setSearchTerm(searchQuery);
    }
    
    if (typeQuery && ['all', 'name', 'specialty'].includes(typeQuery)) {
      setSearchType(typeQuery);
      
      // If search type is specialty and the search term matches a known specialty,
      // automatically set the specialty filter
      if (typeQuery === 'specialty' && searchQuery) {
        const matchedSpecialty = specialties.find(
          spec => spec.toLowerCase() === searchQuery.toLowerCase()
        );
        if (matchedSpecialty) {
          setSpecialty(matchedSpecialty);
        }
      }
    }
  }, [location.search]);

  // Fetch doctors on component mount
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const data = await doctorService.getDoctors();
        setDoctors(data);
      } catch (err) {
        setError("Failed to load doctors. Please try again later.");
        console.error("Error fetching doctors:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctors();
  }, []);
  
  // Filter doctors based on search term, search type, and specialty
  const filteredDoctors = doctors.filter(doctor => {
    let matchesSearch = true;
    
    if (searchTerm) {
      switch (searchType) {
        case 'name':
          matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase());
          break;
        case 'specialty':
          matchesSearch = doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase());
          break;
        case 'all':
        default:
          matchesSearch = 
            doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase());
      }
    }
    
    const matchesSpecialty = !specialty || doctor.specialty === specialty;
    
    return matchesSearch && matchesSpecialty;
  });
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a Doctor</h1>
            <p className="text-gray-600">
              Browse through our verified doctors and book an appointment with the best specialists
            </p>
          </div>
          
          <div className="bg-medical-blue/5 p-6 rounded-lg mb-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or specialty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="md:col-span-5">
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Specialties</SelectItem>
                    {specialties.map(spec => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2">
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  onClick={() => {
                    setSearchTerm("");
                    setSpecialty("");
                  }}
                >
                  <Filter className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-10 w-10 text-medical-blue animate-spin" />
              <span className="ml-3 text-gray-600">Loading doctors...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-500">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-xl font-medium text-gray-700 mb-2">No doctors found</h3>
              <p className="text-gray-500 mb-4">
                {specialty
                  ? `No doctors found in ${specialty} specialty matching "${searchTerm}"`
                  : `No doctors found matching "${searchTerm}"`}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSpecialty("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map((doctor) => (
                <Card key={doctor.id} className="overflow-hidden border-gray-200 hover:border-medical-blue hover:shadow-md transition-all">
                  <CardHeader className="bg-medical-blue/5 pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <span className="text-lg">{doctor.name}</span>
                      <Badge className="bg-medical-blue/10 text-medical-blue hover:bg-medical-blue/20">
                        {doctor.specialty}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {doctor.experience_years 
                        ? `${doctor.experience_years} years of experience` 
                        : "Specialist"}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm text-gray-600">
                      <p className="line-clamp-3">
                        {doctor.bio || "No biography provided."}
                      </p>
                      <p className="text-lg font-semibold text-medical-blue">
                        Consultation Fee: ₹{doctor.consultation_fee || 1500}
                      </p>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="bg-gray-50 flex justify-between">
                    <Link to={`/doctor/${doctor.id}`}>
                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </Link>
                    <Link to={`/book-appointment/${doctor.id}`}>
                      <Button size="sm" className="bg-medical-blue hover:bg-medical-blue/90 flex gap-1 items-center">
                        <Calendar className="h-4 w-4" />
                        Book Appointment
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default FindDoctors;
