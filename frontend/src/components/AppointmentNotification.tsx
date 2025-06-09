import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Phone, Clock, X, Bell, Calendar } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';

// Using relative API paths with Vite proxy
const API_URL = '';

interface Appointment {
  id: string;
  doctor_name: string;
  patient_name: string;
  appointment_date: string;
  consultation_type: string;
  status: string;
  notes?: string;
}

interface NotificationProps {
  userRole: 'doctor' | 'patient';
  onClose: () => void;
}

const AppointmentNotification: React.FC<NotificationProps> = ({ userRole, onClose }) => {
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchUpcomingAppointments();
    
    // Set up interval to check for upcoming appointments every minute
    const interval = setInterval(fetchUpcomingAppointments, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchUpcomingAppointments = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const endpoint = userRole === 'doctor' 
        ? `${API_URL}/api/doctor/appointments/upcoming-notifications`
        : `${API_URL}/api/patient/appointments/upcoming-notifications`;
        
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const appointments = response.data.appointments || [];
      
      // Filter appointments that are starting within the next 15 minutes
      const now = new Date();
      const upcomingSoon = appointments.filter((appointment: Appointment) => {
        const appointmentTime = new Date(appointment.appointment_date);
        const timeDiff = appointmentTime.getTime() - now.getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        
        // Show notification if appointment is within 15 minutes and hasn't started yet
        return minutesDiff > 0 && minutesDiff <= 15;
      });
      
      setUpcomingAppointments(upcomingSoon);
    } catch (err) {
      console.error('Error fetching upcoming appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinConsultation = (appointment: Appointment) => {
    // Navigate directly to VideoCall page with the appointment ID
    // This will ensure patient and doctor join the same meeting room
    navigate(`/video-call/${appointment.id}`);
    
    onClose();
  };

  const formatTimeUntilAppointment = (appointmentDate: string) => {
    const now = new Date();
    const appointmentTime = new Date(appointmentDate);
    const timeDiff = appointmentTime.getTime() - now.getTime();
    const minutesDiff = Math.ceil(timeDiff / (1000 * 60));
    
    if (minutesDiff <= 1) {
      return 'Starting now!';
    } else if (minutesDiff < 60) {
      return `Starts in ${minutesDiff} minute${minutesDiff !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(minutesDiff / 60);
      const mins = minutesDiff % 60;
      return `Starts in ${hours}h ${mins}m`;
    }
  };

  const formatTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (loading || upcomingAppointments.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="shadow-2xl border-l-4 border-l-blue-600 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-semibold">
                Upcoming Consultation{upcomingAppointments.length > 1 ? 's' : ''}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {upcomingAppointments.slice(0, 3).map((appointment) => (
            <div 
              key={appointment.id} 
              className="bg-blue-50 rounded-lg p-3 border border-blue-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-grow">
                  <h4 className="font-medium text-sm text-gray-900">
                    {userRole === 'doctor' 
                      ? appointment.patient_name 
                      : `Dr. ${appointment.doctor_name}`
                    }
                  </h4>
                  <div className="flex items-center space-x-4 text-xs text-gray-600 mt-1">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(appointment.appointment_date)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {appointment.consultation_type === 'voice' || appointment.consultation_type === 'phone' ? (
                        <Phone className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      <span>
                        {appointment.consultation_type === 'voice' || appointment.consultation_type === 'phone' 
                          ? 'Voice Call' 
                          : 'Video Call'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-orange-600">
                  {formatTimeUntilAppointment(appointment.appointment_date)}
                </span>
                
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                  onClick={() => handleJoinConsultation(appointment)}
                >
                  {appointment.consultation_type === 'voice' || appointment.consultation_type === 'phone' ? (
                    <>
                      <Phone className="h-3 w-3 mr-1" />
                      Join
                    </>
                  ) : (
                    <>
                      <Video className="h-3 w-3 mr-1" />
                      Join
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
          
          {upcomingAppointments.length > 3 && (
            <div className="text-center text-xs text-gray-500">
              +{upcomingAppointments.length - 3} more consultation{upcomingAppointments.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentNotification; 