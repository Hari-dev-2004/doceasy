
import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/ui/hero/Hero";
import FeatureCard from "@/components/features/FeatureCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  VideoIcon, 
  Clock, 
  CalendarIcon, 
  CreditCard, 
  MessageSquare, 
  Shield, 
  Users
} from "lucide-react";

const Index = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <Hero />
        
        {/* How It Works Section */}
        <section className="bg-white py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How EasyDoc Works</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Get the healthcare you need, when you need it, in just three simple steps.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-medical-blue text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    1
                  </div>
                  {/* Connector line */}
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gray-200 -z-10"></div>
                </div>
                <h3 className="text-xl font-bold mb-2">Find Your Specialist</h3>
                <p className="text-gray-600">
                  Browse our network of licensed doctors and specialists across multiple fields.
                </p>
              </div>
              
              {/* Step 2 */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-medical-blue text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    2
                  </div>
                  {/* Connector line */}
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gray-200 -z-10"></div>
                </div>
                <h3 className="text-xl font-bold mb-2">Book Appointment</h3>
                <p className="text-gray-600">
                  Select a convenient time slot and book your consultation with just a few clicks.
                </p>
              </div>
              
              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-medical-blue text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold mb-2">Start Consultation</h3>
                <p className="text-gray-600">
                  Join your secure video consultation and receive expert medical advice.
                </p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <Link to="/register">
                <Button className="bg-medical-blue hover:bg-medical-blue-dark">
                  Create Your Account
                </Button>
              </Link>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="bg-gray-50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose EasyDoc</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Our platform offers everything you need for a seamless telehealth experience.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              <FeatureCard 
                icon={<VideoIcon size={24} />}
                title="Video Consultations" 
                description="Connect with doctors face-to-face through our high-quality, secure video platform."
                className="animate-fade-in animate-delay-100"
              />
              <FeatureCard 
                icon={<Clock size={24} />}
                title="24/7 Availability" 
                description="Access healthcare professionals around the clock, even on weekends and holidays."
                className="animate-fade-in animate-delay-200"
              />
              <FeatureCard 
                icon={<CalendarIcon size={24} />}
                title="Easy Scheduling" 
                description="Book, reschedule, or cancel appointments with just a few clicks."
                className="animate-fade-in animate-delay-300"
              />
              <FeatureCard 
                icon={<CreditCard size={24} />}
                title="Secure Payments" 
                description="Pay for consultations securely online with various payment methods."
                className="animate-fade-in animate-delay-100"
              />
              <FeatureCard 
                icon={<MessageSquare size={24} />}
                title="Follow-up Messages" 
                description="Stay connected with your doctor after consultations for any questions."
                className="animate-fade-in animate-delay-200"
              />
              <FeatureCard 
                icon={<Shield size={24} />}
                title="Private & Secure" 
                description="Your health information is protected with enterprise-grade security."
                className="animate-fade-in animate-delay-300"
              />
            </div>
          </div>
        </section>
        
        {/* Specialties Section */}
        <section className="bg-white py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Medical Specialties</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                We offer a wide range of medical specialties to address all your healthcare needs.
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
              {[
                { name: "General Medicine", icon: "🩺" },
                { name: "Pediatrics", icon: "👶" },
                { name: "Dermatology", icon: "🧴" },
                { name: "Cardiology", icon: "❤️" },
                { name: "Psychiatry", icon: "🧠" },
                { name: "Gynecology", icon: "👩‍⚕️" },
                { name: "Orthopedics", icon: "🦴" },
                { name: "Neurology", icon: "🔬" },
                { name: "Ophthalmology", icon: "👁️" },
                { name: "ENT", icon: "👂" },
                { name: "Nutrition", icon: "🥗" },
                { name: "Physical Therapy", icon: "💪" }
              ].map((specialty, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">{specialty.icon}</div>
                  <h3 className="text-sm font-medium">{specialty.name}</h3>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-12">
              <Link to="/doctors">
                
              </Link>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="bg-gray-50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Patients Say</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Don't just take our word for it - hear from our satisfied patients.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center mb-4">
                  <div className="text-yellow-400 flex mr-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="text-gray-600">5.0</span>
                </div>
                <p className="text-gray-700 mb-6">
                  "EasyDoc saved me so much time. I was able to consult with a specialist from home without taking time off work. The doctor was knowledgeable and caring."
                </p>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 mr-3"></div>
                  <div>
                    <h4 className="font-medium">Sarah Johnson</h4>
                    <p className="text-sm text-gray-600">Patient</p>
                  </div>
                </div>
              </div>
              
              {/* Testimonial 2 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center mb-4">
                  <div className="text-yellow-400 flex mr-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="text-gray-600">5.0</span>
                </div>
                <p className="text-gray-700 mb-6">
                  "As a busy parent, EasyDoc has been a game-changer. I can get medical advice for my kids without dragging them to a waiting room full of other sick children."
                </p>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 mr-3"></div>
                  <div>
                    <h4 className="font-medium">Michael Rodriguez</h4>
                    <p className="text-sm text-gray-600">Parent of 2</p>
                  </div>
                </div>
              </div>
              
              {/* Testimonial 3 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center mb-4">
                  <div className="text-yellow-400 flex mr-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="text-gray-600">4.9</span>
                </div>
                <p className="text-gray-700 mb-6">
                  "The platform is so easy to use. I was nervous about video consultations, but the interface is intuitive and the doctors take their time to listen and explain."
                </p>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 mr-3"></div>
                  <div>
                    <h4 className="font-medium">Emma Thompson</h4>
                    <p className="text-sm text-gray-600">Regular User</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        
        {/* Final CTA Section */}
        <section className="bg-white py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="bg-gradient-to-r from-medical-blue-dark to-medical-blue rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-12 md:p-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to Experience Healthcare Reimagined?
                </h2>
                <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
                  Join thousands of patients who've discovered the convenience of telehealth consultations with top specialists.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link to="/register">
                    <Button size="lg" className="bg-white text-medical-blue hover:bg-blue-50 px-8">
                      Patient Sign Up
                    </Button>
                  </Link>
                  <Link to="/doctor-registration">
                    <Button size="lg" className="bg-white text-medical-blue hover:bg-blue-50 border border-white px-8">
                      Doctor Sign Up
                    </Button>
                  </Link>
                  <Link to="/doctors">
                    
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
