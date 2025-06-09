import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  doctor_name?: string;
  doctor?: string;
  specialty?: string;
  appointment_date?: string;
  date?: string;
  profile_picture?: string;
}

const Feedback = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    // Try to get appointment data from localStorage or use fallback
    const storedAppointment = localStorage.getItem('feedbackAppointment');
    const storedDoctor = localStorage.getItem('doctorInfo');
    
    if (storedAppointment) {
      try {
        const appointmentData = JSON.parse(storedAppointment);
        setAppointment(appointmentData);
      } catch (e) {
        console.error('Failed to parse appointment data:', e);
      }
    } else if (storedDoctor) {
      try {
        const doctorData = JSON.parse(storedDoctor);
        setAppointment({
          id: id || "1",
          doctor: `Dr. ${doctorData.name}`,
          doctor_name: doctorData.name,
          specialty: doctorData.specialty,
          date: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          profile_picture: doctorData.profile_picture
        });
      } catch (e) {
        console.error('Failed to parse doctor data:', e);
      }
    }
    
    // Fallback to default data if no stored data found
    if (!appointment) {
      setAppointment({
        id: id || "1",
        doctor: "Dr. Sarah Johnson",
        specialty: "General Practitioner",
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
      });
    }
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Implement actual feedback submission to backend
    // For now, simulate submission processing
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      
      // Clear stored appointment data
      localStorage.removeItem('feedbackAppointment');
      
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback!",
      });
    }, 1000);
  };

  if (!appointment) {
    return (
      <div className="container max-w-lg mx-auto p-4 py-8">
        <div className="text-center">
          <p>Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container max-w-md mx-auto p-4 py-12">
        <Card className="border-green-500 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-gray-500 mb-6">
                Your feedback has been submitted successfully. We appreciate your input!
              </p>
              
              <div className="flex justify-center mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-8 w-8 ${
                      star <= rating
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              
              <div className="space-y-4 w-full">
                <Link to="/dashboard/patient">
                  <Button className="w-full">Return to Dashboard</Button>
                </Link>
                <Link to="/find-doctors">
                  <Button variant="outline" className="w-full">
                    Book Another Appointment
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doctorName = appointment.doctor_name || appointment.doctor || "Doctor";
  const displayImage = appointment.profile_picture || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80";

  return (
    <div className="container max-w-lg mx-auto p-4 py-8">
      <Link to="/dashboard/patient" className="flex items-center text-gray-600 mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Return to Dashboard
      </Link>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>How was your experience?</CardTitle>
          <CardDescription>
            Share your feedback about your consultation with {doctorName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <img 
                  src={displayImage} 
                  alt={doctorName} 
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-medium text-lg">{doctorName}</h3>
                  <p className="text-gray-500">{appointment.specialty || "General Practitioner"}</p>
                  <p className="text-gray-500 text-sm">{appointment.appointment_date || appointment.date}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <Label className="block mb-2">Rate your experience</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-8 w-8 cursor-pointer ${
                        star <= (hoverRating || rating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      }`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <Label htmlFor="feedback" className="block mb-2">
                  Share your feedback (optional)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us about your experience with the doctor, the consultation quality, and any other feedback..."
                  rows={5}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || rating === 0}
              >
                {loading ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;
