import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle, AlertCircle, FileText, User } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import axios from 'axios';
import { API_URL } from '@/config';

// API configuration
// const API_URL = '';

const DoctorProfileCreation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    specialty: '',
    experienceYears: '',
    consultationFee: '',
    bio: ''
  });
  
  // File uploads
  const [files, setFiles] = useState({
    medicalLicense: null as File | null,
    mbbsCertificate: null as File | null
  });
  
  const [fileErrors, setFileErrors] = useState({
    medicalLicense: '',
    mbbsCertificate: ''
  });

  // Specialties list
  const specialties = [
    'Cardiology', 'Dermatology', 'Emergency Medicine', 'Family Medicine',
    'Gastroenterology', 'General Surgery', 'Internal Medicine', 'Neurology',
    'Obstetrics & Gynecology', 'Oncology', 'Ophthalmology', 'Orthopedics',
    'Pediatrics', 'Psychiatry', 'Pulmonology', 'Radiology', 'Urology', 'Other'
  ];

  // Check authentication on component mount
  useEffect(() => {
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('user_role');
      
      if (!token || userRole !== 'doctor') {
      toast({
        title: "Access Denied",
        description: "Please log in as a doctor to access this page",
        variant: "destructive"
      });
        navigate('/login/doctor');
      return;
    }
  }, [navigate, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (fileType: 'medicalLicense' | 'mbbsCertificate', file: File | null) => {
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setFileErrors(prev => ({
          ...prev,
          [fileType]: 'Only PDF, JPEG, JPG, and PNG files are allowed'
        }));
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setFileErrors(prev => ({
          ...prev,
          [fileType]: 'File size must be less than 5MB'
        }));
        return;
      }

      setFileErrors(prev => ({
        ...prev,
        [fileType]: ''
      }));
    }

    setFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const validateStep1 = () => {
    const { firstName, lastName, phoneNumber, specialty, experienceYears, consultationFee } = formData;
    
    if (!firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!specialty) {
      setError('Specialty is required');
      return false;
    }
    if (!experienceYears || parseInt(experienceYears) < 0) {
      setError('Valid experience years is required');
      return false;
    }
    if (!consultationFee || parseFloat(consultationFee) <= 0) {
      setError('Valid consultation fee is required');
      return false;
    }
    
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!files.medicalLicense) {
      setError('Medical license document is required');
      return false;
    }
    if (!files.mbbsCertificate) {
      setError('MBBS certificate document is required');
      return false;
    }
    if (fileErrors.medicalLicense || fileErrors.mbbsCertificate) {
      setError('Please fix file upload errors before proceeding');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) {
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
    const token = localStorage.getItem('token');
    
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Add profile data
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });
      
      // Add files
    if (files.medicalLicense) {
        formDataToSend.append('medicalLicense', files.medicalLicense);
      }
      if (files.mbbsCertificate) {
        formDataToSend.append('mbbsCertificate', files.mbbsCertificate);
      }

      const response = await axios.post(
        `${API_URL}/api/doctor/create-profile`,
        formDataToSend,
        {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
        }
      );
      
      toast({
        title: "Profile Submitted Successfully!",
        description: "Your profile has been submitted for admin verification. You'll be notified via email once approved.",
      });
      
      // Redirect to doctor dashboard
      navigate('/dashboard/doctor');

    } catch (error: any) {
      console.error('Profile submission error:', error);
      
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user_role');
        navigate('/login/doctor');
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to submit profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = currentStep === 1 ? 50 : 100;
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Doctor Profile</h1>
            <p className="text-gray-600">
              Step {currentStep} of 2 - {currentStep === 1 ? 'Professional Information' : 'Document Upload'}
            </p>
            <Progress value={progress} className="mt-4" />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStep === 1 ? (
                  <>
                    <User className="h-5 w-5 text-medical-teal" />
                    Professional Information
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 text-medical-teal" />
                    Document Upload
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 
                  ? 'Provide your professional details and experience'
                  : 'Upload your medical credentials for verification'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Enter your first name"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Enter your last name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="specialty">Medical Specialty *</Label>
                    <Select onValueChange={(value) => handleSelectChange('specialty', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty} value={specialty}>
                            {specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="experienceYears">Years of Experience *</Label>
                    <Input
                        id="experienceYears"
                        name="experienceYears"
                        type="number"
                        min="0"
                        max="50"
                        value={formData.experienceYears}
                        onChange={handleInputChange}
                        placeholder="Years of experience"
                      required
                    />
                  </div>
                  
                    <div>
                      <Label htmlFor="consultationFee">Consultation Fee (₹) *</Label>
                    <Input
                      id="consultationFee"
                      name="consultationFee"
                      type="number"
                      placeholder="1500"
                      min="100"
                      value={formData.consultationFee}
                      onChange={handleInputChange}
                      required
                    />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Professional Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      placeholder="Tell patients about your experience, approach to care, and specializations..."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please upload clear copies of your medical credentials. Accepted formats: PDF, JPEG, PNG (max 5MB each)
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="medicalLicense" className="text-base font-medium">
                        Medical License *
                            </Label>
                      <div className="mt-2">
                            <Input
                              id="medicalLicense"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange('medicalLicense', e.target.files?.[0] || null)}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-medical-teal file:text-white hover:file:bg-medical-teal/90"
                        />
                        {fileErrors.medicalLicense && (
                          <p className="text-red-500 text-sm mt-1">{fileErrors.medicalLicense}</p>
                        )}
                        {files.medicalLicense && !fileErrors.medicalLicense && (
                          <p className="text-green-600 text-sm mt-1 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {files.medicalLicense.name} uploaded successfully
                          </p>
                        )}
                      </div>
                      </div>
                      
                    <div>
                      <Label htmlFor="mbbsCertificate" className="text-base font-medium">
                        MBBS Certificate *
                            </Label>
                      <div className="mt-2">
                            <Input
                          id="mbbsCertificate"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange('mbbsCertificate', e.target.files?.[0] || null)}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-medical-teal file:text-white hover:file:bg-medical-teal/90"
                        />
                        {fileErrors.mbbsCertificate && (
                          <p className="text-red-500 text-sm mt-1">{fileErrors.mbbsCertificate}</p>
                        )}
                        {files.mbbsCertificate && !fileErrors.mbbsCertificate && (
                          <p className="text-green-600 text-sm mt-1 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {files.mbbsCertificate.name} uploaded successfully
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Both documents are mandatory. Your profile will be reviewed by our admin team 
                      and you'll be notified via email once verified. This typically takes 1-2 business days.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex justify-between pt-6">
                {currentStep > 1 && (
                  <Button
                    variant="outline" 
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  {currentStep === 1 ? (
                    <Button 
                      onClick={handleNext}
                      className="bg-medical-teal hover:bg-medical-teal/90"
                    >
                      Next: Upload Documents
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-medical-teal hover:bg-medical-teal/90"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting Profile...
                        </>
                    ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Submit for Verification
                        </>
                    )}
                  </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default DoctorProfileCreation; 