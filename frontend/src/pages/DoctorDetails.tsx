import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Loader2, Calendar, Clock, MapPin, Mail, Phone, Star, BookOpen, User } from "lucide-react";
import { doctorService, Doctor } from "@/services/doctorService";
import { API_URL } from "@/config";

const DoctorDetails = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  useEffect(() => {
    const fetchDoctorDetails = async () => {
      if (!doctorId) return;
      
      setLoading(true);
      try {
        const data = await doctorService.getDoctorDetails(doctorId);
        setDoctor(data);
      } catch (err: any) {
        setError(typeof err === 'string' ? err : "Failed to load doctor details");
        console.error("Error fetching doctor details:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctorDetails();
  }, [doctorId]);
  
  const handleBookAppointment = () => {
    if (doctor) {
      navigate(`/book-appointment/${doctor.id}`);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-medical-blue animate-spin" />
            <span className="mt-4 text-gray-600">Loading doctor details...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Doctor Not Found</h1>
            <p className="text-gray-600 mb-6">
              {error || "The doctor you're looking for may not exist or has not been approved yet."}
            </p>
            <div className="space-x-4">
              <Link to="/find-doctors">
                <Button variant="default">Find Other Doctors</Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Go Home</Button>
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link 
              to="/find-doctors" 
              className="text-medical-blue hover:underline flex items-center text-sm mb-4"
            >
              &larr; Back to Doctors
            </Link>
            
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-medical-blue/5 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-28 h-28 rounded-full bg-medical-blue/10 flex items-center justify-center overflow-hidden">
                      {doctor.profile_picture ? (
                        <img 
                          src={`${API_URL}/${doctor.profile_picture}`} 
                          alt={doctor.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={40} className="text-medical-blue/40" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{doctor.name}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge className="bg-medical-blue/10 text-medical-blue hover:bg-medical-blue/20">
                            {doctor.specialty}
                          </Badge>
                          {doctor.experience_years && (
                            <span className="text-sm text-gray-600 flex items-center">
                              <Clock size={14} className="mr-1" />
                              {doctor.experience_years} years experience
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                        <Button 
                          className="bg-medical-blue hover:bg-medical-blue/90"
                          onClick={handleBookAppointment}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Book Appointment
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="about" className="p-6">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="about">About</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                
                <TabsContent value="about" className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-3">Biography</h3>
                    <p className="text-gray-700">
                      {doctor.bio || "No biography provided for this doctor."}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Services</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start">
                            <BookOpen className="h-5 w-5 mr-2 text-medical-blue flex-shrink-0 mt-0.5" />
                            <span>Consultations</span>
                          </li>
                          <li className="flex items-start">
                            <BookOpen className="h-5 w-5 mr-2 text-medical-blue flex-shrink-0 mt-0.5" />
                            <span>Medical Advice</span>
                          </li>
                          <li className="flex items-start">
                            <BookOpen className="h-5 w-5 mr-2 text-medical-blue flex-shrink-0 mt-0.5" />
                            <span>Prescriptions</span>
                          </li>
                          <li className="flex items-start">
                            <BookOpen className="h-5 w-5 mr-2 text-medical-blue flex-shrink-0 mt-0.5" />
                            <span>Follow-up Consultations</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Consultation Fee</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                          <span className="text-gray-700">Online Consultation</span>
                          <span className="font-medium text-lg text-medical-blue">₹{doctor.consultation_fee || 1500}</span>
                        </div>
                        <div className="pt-4">
                          <p className="text-sm text-gray-600">
                            * Fee includes initial consultation and basic follow-up within 3 days.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Specializations</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-gray-50">
                          {doctor.specialty}
                        </Badge>
                        {/* More specializations could be added here */}
                      </div>
                      
                      <h3 className="text-lg font-medium mt-6 mb-3">Education</h3>
                      <div className="space-y-3">
                        <div className="flex flex-col">
                          <span className="font-medium">MBBS</span>
                          <span className="text-sm text-gray-600">AIIMS Medical College</span>
                          <span className="text-xs text-gray-500">2010 - 2016</span>
                        </div>
                        {/* More education details could be added here */}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-3">Contact Information</h3>
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <Mail className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Email</p>
                            <p className="text-gray-600 text-sm mt-1">
                              Contact via appointment
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Phone className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Phone</p>
                            <p className="text-gray-600 text-sm mt-1">
                              Available after booking
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <MapPin className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Location</p>
                            <p className="text-gray-600 text-sm mt-1">
                              Online consultations available nationwide
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Note:</strong> This doctor has been verified by our medical team and administration. All certifications and qualifications have been reviewed and approved.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default DoctorDetails;
