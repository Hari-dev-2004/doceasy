from datetime import datetime, timedelta
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from flask import current_app
import random
import string
import os

class BaseModel:
    """Base model with common methods for all models"""
    
    @staticmethod
    def serialize_id(document):
        """Convert ObjectId to string for JSON serialization"""
        if document and '_id' in document:
            document['id'] = str(document['_id'])
            del document['_id']
        return document
    
    @staticmethod
    def serialize_list(documents):
        """Serialize a list of documents"""
        return [BaseModel.serialize_id(doc) for doc in documents]

class Admin(BaseModel):
    """Admin model for authentication and admin users"""
    collection_name = 'admins'
    
    @staticmethod
    def create(db, email, password, name=None):
        """Create a new admin user"""
        admin = {
            'email': email,
            'password': generate_password_hash(password),
            'name': name or email.split('@')[0],
            'role': 'admin',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        result = db[Admin.collection_name].insert_one(admin)
        admin['_id'] = result.inserted_id
        return Admin.serialize_id(admin)
    
    @staticmethod
    def find_by_email(db, email):
        """Find admin by email"""
        admin = db[Admin.collection_name].find_one({'email': email})
        return Admin.serialize_id(admin) if admin else None
    
    @staticmethod
    def verify_password(admin, password):
        """Verify password for admin"""
        return check_password_hash(admin['password'], password)
    
    @staticmethod
    def generate_token(admin):
        """Generate JWT token for admin"""
        payload = {
            'id': admin['id'],
            'email': admin['email'],
            'role': admin['role'],
            'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

    @staticmethod
    def generate_reset_token():
        """Generate a secure reset token"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

    @staticmethod
    def create_password_reset_request(db, email):
        """Create a password reset request for admin"""
        admin = Admin.find_by_email(db, email)
        if not admin:
            return None
        
        reset_token = Admin.generate_reset_token()
        reset_data = {
            'reset_token': reset_token,
            'reset_token_expires': datetime.utcnow() + timedelta(hours=1),
            'updated_at': datetime.utcnow()
        }
        
        result = db[Admin.collection_name].update_one(
            {'_id': ObjectId(admin['id'])},
            {'$set': reset_data}
        )
        
        if result.modified_count > 0:
            admin.update(reset_data)
            return admin
        return None

    @staticmethod
    def verify_reset_token(db, email, reset_token):
        """Verify password reset token"""
        admin = db[Admin.collection_name].find_one({
            'email': email,
            'reset_token': reset_token,
            'reset_token_expires': {'$gt': datetime.utcnow()}
        })
        return Admin.serialize_id(admin) if admin else None

    @staticmethod
    def reset_password(db, email, reset_token, new_password):
        """Reset password using reset token"""
        admin = Admin.verify_reset_token(db, email, reset_token)
        if not admin:
            return False
        
        result = db[Admin.collection_name].update_one(
            {'_id': ObjectId(admin['id'])},
            {
                '$set': {
                    'password': generate_password_hash(new_password),
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'reset_token': '',
                    'reset_token_expires': ''
                }
            }
        )
        
        return result.modified_count > 0

class Doctor(BaseModel):
    """Doctor model"""
    collection_name = 'doctors'
    
    @staticmethod
    def generate_otp():
        """Generate a 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=6))
    
    @staticmethod
    def create_registration(db, data):
        """Create a new doctor registration with email verification"""
        doctor = {
            'user': data.get('email'),  # Use email as unique user identifier
            'email': data.get('email'),
            'password': generate_password_hash(data.get('password')),
            'role': 'doctor',
            'emailVerified': False,
            'profileCompleted': False,
            'verificationStatus': 'email_pending',  # email_pending -> profile_pending -> admin_pending -> approved/rejected
            'otp': Doctor.generate_otp(),
            'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
            'registrationDate': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': False
        }
        result = db[Doctor.collection_name].insert_one(doctor)
        doctor['_id'] = result.inserted_id
        return Doctor.serialize_id(doctor)
    
    @staticmethod
    def create_profile(db, doctor_id, profile_data, document_paths):
        """Complete doctor profile after email verification"""
        profile_update = {
            'first_name': profile_data.get('firstName'),
            'last_name': profile_data.get('lastName'),
            'name': f"{profile_data.get('firstName', '')} {profile_data.get('lastName', '')}".strip(),
            'phone': profile_data.get('phoneNumber'),
            'specialty': profile_data.get('specialty'),
            'experience_years': profile_data.get('experienceYears'),
            'consultationFee': float(profile_data.get('consultationFee', 0)),
            'bio': profile_data.get('bio', ''),
            'document_paths': document_paths,
            'profileCompleted': True,
            'verificationStatus': 'admin_pending',
            'is_active': True,
            'updated_at': datetime.utcnow()
        }
        
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(doctor_id)},
            {'$set': profile_update}
        )
        
        if result.modified_count > 0:
            return Doctor.find_by_id(db, doctor_id)
        return None
    
    @staticmethod
    def find_by_email(db, email):
        """Find doctor by email"""
        doctor = db[Doctor.collection_name].find_one({'email': email})
        return Doctor.serialize_id(doctor) if doctor else None
    
    @staticmethod
    def verify_otp(db, doctor_id, otp):
        """Verify OTP and mark email as verified"""
        try:
            doctor = db[Doctor.collection_name].find_one({
                '_id': ObjectId(doctor_id),
                'otp': otp,
                'otpExpiresAt': {'$gt': datetime.utcnow()}
            })
            
            if doctor:
                result = db[Doctor.collection_name].update_one(
                    {'_id': ObjectId(doctor_id)},
                    {
                        '$set': {
                            'emailVerified': True,
                            'verificationStatus': 'profile_pending',
                            'otp': None,
                            'otpExpiresAt': None,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                return result.modified_count > 0
            return False
        except:
            return False
    
    @staticmethod
    def resend_otp(db, doctor_id):
        """Generate and update new OTP"""
        new_otp = Doctor.generate_otp()
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(doctor_id)},
            {
                '$set': {
                    'otp': new_otp,
                    'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        if result.modified_count > 0:
            doctor = db[Doctor.collection_name].find_one({'_id': ObjectId(doctor_id)})
            return Doctor.serialize_id(doctor)
        return None
    
    @staticmethod
    def verify_password(doctor, password):
        """Verify password for doctor"""
        return check_password_hash(doctor['password'], password)
    
    @staticmethod
    def generate_token(doctor):
        """Generate JWT token for doctor"""
        payload = {
            'id': doctor['id'],
            'email': doctor['email'],
            'role': 'doctor',
            'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    @staticmethod
    def generate_reset_token():
        """Generate a secure reset token"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

    @staticmethod
    def create_password_reset_request(db, email):
        """Create a password reset request for doctor"""
        doctor = Doctor.find_by_email(db, email)
        if not doctor:
            return None
        
        reset_token = Doctor.generate_reset_token()
        reset_data = {
            'reset_token': reset_token,
            'reset_token_expires': datetime.utcnow() + timedelta(hours=1),
            'updated_at': datetime.utcnow()
        }
        
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(doctor['id'])},
            {'$set': reset_data}
        )
        
        if result.modified_count > 0:
            doctor.update(reset_data)
            return doctor
        return None

    @staticmethod
    def verify_reset_token(db, email, reset_token):
        """Verify password reset token"""
        doctor = db[Doctor.collection_name].find_one({
            'email': email,
            'reset_token': reset_token,
            'reset_token_expires': {'$gt': datetime.utcnow()}
        })
        return Doctor.serialize_id(doctor) if doctor else None

    @staticmethod
    def reset_password(db, email, reset_token, new_password):
        """Reset password using reset token"""
        doctor = Doctor.verify_reset_token(db, email, reset_token)
        if not doctor:
            return False
        
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(doctor['id'])},
            {
                '$set': {
                    'password': generate_password_hash(new_password),
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'reset_token': '',
                    'reset_token_expires': ''
                }
            }
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def create(db, data):
        """Create a new doctor (legacy method for backward compatibility)"""
        doctor = {
            'name': data.get('name'),
            'email': data.get('email'),
            'phone': data.get('phone'),
            'specialty': data.get('specialty'),
            'bio': data.get('bio', ''),
            'consultationFee': data.get('consultationFee', 0),
            'verificationStatus': 'pending',
            'documents': data.get('documents', []),
            'document_paths': data.get('document_paths', {}),
            'patients': 0,
            'joinDate': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        result = db[Doctor.collection_name].insert_one(doctor)
        doctor['_id'] = result.inserted_id
        return Doctor.serialize_id(doctor)
    
    @staticmethod
    def find_all(db, filters=None):
        """Find all doctors with optional filters"""
        query = filters or {}
        doctors = list(db[Doctor.collection_name].find(query))
        return Doctor.serialize_list(doctors)
    
    @staticmethod
    def find_by_id(db, doctor_id):
        """Find doctor by ID"""
        doctor = db[Doctor.collection_name].find_one({'_id': ObjectId(doctor_id)})
        return Doctor.serialize_id(doctor) if doctor else None
    
    @staticmethod
    def update_verification_status(db, doctor_id, approved):
        """Update doctor verification status"""
        status = 'approved' if approved else 'rejected'
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(doctor_id)},
            {
                '$set': {
                    'verificationStatus': status,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def delete(db, doctor_id):
        """Delete a doctor"""
        result = db[Doctor.collection_name].delete_one({'_id': ObjectId(doctor_id)})
        return result.deleted_count > 0

class Patient(BaseModel):
    """Patient model"""
    collection_name = 'patients'
    
    @staticmethod
    def generate_otp():
        """Generate a 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=6))
    
    @staticmethod
    def create(db, data):
        """Create a new patient with email verification"""
        # Create full name from first and last name
        full_name = f"{data.get('firstName', '')} {data.get('lastName', '')}".strip()
        
        patient = {
            'firstName': data.get('firstName'),
            'lastName': data.get('lastName'),
            'name': full_name,
            'email': data.get('email'),
            'phone': data.get('phoneNumber'),
            'password': generate_password_hash(data.get('password')),
            'gender': data.get('gender'),
            'dateOfBirth': data.get('dateOfBirth'),
            'consultations': 0,
            'lastVisit': None,
            'status': 'pending_verification',
            'emailVerified': False,
            'otp': Patient.generate_otp(),
            'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
            'registrationDate': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db[Patient.collection_name].insert_one(patient)
        patient['_id'] = result.inserted_id
        return Patient.serialize_id(patient)
    
    @staticmethod
    def find_all(db):
        """Find all patients"""
        patients = list(db[Patient.collection_name].find())
        return Patient.serialize_list(patients)
    
    @staticmethod
    def find_by_id(db, patient_id):
        """Find patient by ID"""
        try:
            patient = db[Patient.collection_name].find_one({'_id': ObjectId(patient_id)})
            return Patient.serialize_id(patient) if patient else None
        except:
            return None
    
    @staticmethod
    def find_by_email(db, email):
        """Find patient by email"""
        patient = db[Patient.collection_name].find_one({'email': email})
        return Patient.serialize_id(patient) if patient else None
    
    @staticmethod
    def verify_otp(db, patient_id, otp):
        """Verify OTP and activate patient account"""
        try:
            patient = db[Patient.collection_name].find_one({
                '_id': ObjectId(patient_id),
                'otp': otp,
                'otpExpiresAt': {'$gt': datetime.utcnow()}
            })
            
            if patient:
                result = db[Patient.collection_name].update_one(
                    {'_id': ObjectId(patient_id)},
                    {
                        '$set': {
                            'emailVerified': True,
                            'status': 'active',
                            'otp': None,
                            'otpExpiresAt': None,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                return result.modified_count > 0
            return False
        except:
            return False
    
    @staticmethod
    def resend_otp(db, patient_id):
        """Generate and update new OTP"""
        new_otp = Patient.generate_otp()
        result = db[Patient.collection_name].update_one(
            {'_id': ObjectId(patient_id)},
            {
                '$set': {
                    'otp': new_otp,
                    'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        if result.modified_count > 0:
            patient = db[Patient.collection_name].find_one({'_id': ObjectId(patient_id)})
            return Patient.serialize_id(patient)
        return None
    
    @staticmethod
    def verify_password(patient, password):
        """Verify password for patient"""
        return check_password_hash(patient['password'], password)
    
    @staticmethod
    def generate_token(patient):
        """Generate JWT token for patient"""
        payload = {
            'id': patient['id'],
            'email': patient['email'],
            'role': 'patient',
            'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    @staticmethod
    def generate_reset_token():
        """Generate a secure reset token"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

    @staticmethod
    def create_password_reset_request(db, email):
        """Create a password reset request for patient"""
        patient = Patient.find_by_email(db, email)
        if not patient:
            return None
        
        reset_token = Patient.generate_reset_token()
        reset_data = {
            'reset_token': reset_token,
            'reset_token_expires': datetime.utcnow() + timedelta(hours=1),
            'updated_at': datetime.utcnow()
        }
        
        result = db[Patient.collection_name].update_one(
            {'_id': ObjectId(patient['id'])},
            {'$set': reset_data}
        )
        
        if result.modified_count > 0:
            patient.update(reset_data)
            return patient
        return None

    @staticmethod
    def verify_reset_token(db, email, reset_token):
        """Verify password reset token"""
        patient = db[Patient.collection_name].find_one({
            'email': email,
            'reset_token': reset_token,
            'reset_token_expires': {'$gt': datetime.utcnow()}
        })
        return Patient.serialize_id(patient) if patient else None

    @staticmethod
    def reset_password(db, email, reset_token, new_password):
        """Reset password using reset token"""
        patient = Patient.verify_reset_token(db, email, reset_token)
        if not patient:
            return False
        
        result = db[Patient.collection_name].update_one(
            {'_id': ObjectId(patient['id'])},
            {
                '$set': {
                    'password': generate_password_hash(new_password),
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'reset_token': '',
                    'reset_token_expires': ''
                }
            }
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def update_status(db, patient_id, status):
        """Update patient status"""
        result = db[Patient.collection_name].update_one(
            {'_id': ObjectId(patient_id)},
            {
                '$set': {
                    'status': status,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

class Complaint(BaseModel):
    """Complaint model"""
    collection_name = 'complaints'
    
    @staticmethod
    def create(db, data):
        """Create a new complaint"""
        complaint = {
            'patientId': data.get('patientId'),
            'patientName': data.get('patientName'),
            'doctorId': data.get('doctorId'),
            'doctorName': data.get('doctorName'),
            'description': data.get('description'),
            'severity': data.get('severity', 'medium'),
            'status': 'new',
            'adminNotes': '',
            'date': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db[Complaint.collection_name].insert_one(complaint)
        complaint['_id'] = result.inserted_id
        return Complaint.serialize_id(complaint)
    
    @staticmethod
    def find_all(db):
        """Find all complaints"""
        complaints = list(db[Complaint.collection_name].find().sort('created_at', -1))
        return Complaint.serialize_list(complaints)
    
    @staticmethod
    def update_status(db, complaint_id, status, notes=None):
        """Update complaint status"""
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        if notes:
            update_data['adminNotes'] = notes
            
        result = db[Complaint.collection_name].update_one(
            {'_id': ObjectId(complaint_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0

class Notification(BaseModel):
    """Notification model"""
    collection_name = 'notifications'
    
    @staticmethod
    def create(db, data):
        """Create a new notification"""
        notification = {
            'title': data.get('title'),
            'message': data.get('message'),
            'type': data.get('type', 'info'),
            'read': False,
            'userId': data.get('userId'),
            'relatedTo': data.get('relatedTo'),
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'time': datetime.utcnow().strftime('%H:%M'),
            'created_at': datetime.utcnow()
        }
        result = db[Notification.collection_name].insert_one(notification)
        notification['_id'] = result.inserted_id
        return Notification.serialize_id(notification)
    
    @staticmethod
    def find_admin_notifications(db):
        """Find all admin notifications"""
        notifications = list(db[Notification.collection_name].find(
            {'userId': 'admin'}
        ).sort('created_at', -1))
        return Notification.serialize_list(notifications)
    
    @staticmethod
    def mark_as_read(db, notification_id):
        """Mark notification as read"""
        result = db[Notification.collection_name].update_one(
            {'_id': ObjectId(notification_id)},
            {'$set': {'read': True}}
        )
        return result.modified_count > 0
    
    @staticmethod
    def mark_all_as_read(db, user_id='admin'):
        """Mark all notifications as read for a user"""
        result = db[Notification.collection_name].update_many(
            {'userId': user_id, 'read': False},
            {'$set': {'read': True}}
        )
        return result.modified_count

class Appointment(BaseModel):
    """Appointment model"""
    collection_name = 'appointments'
    
    @staticmethod
    def create(db, data):
        """Create a new appointment"""
        appointment = {
            'patient_id': data.get('patient_id'),
            'patient_name': data.get('patient_name'),
            'patient_phone': data.get('patient_phone', ''),
            'patient_email': data.get('patient_email', ''),
            'doctor_id': data.get('doctor_id'),
            'doctor_name': data.get('doctor_name'),
            'appointment_date': data.get('appointment_date'),  # ISO datetime string
            'status': data.get('status', 'pending'),  # pending, confirmed, completed, cancelled
            'reason': data.get('reason', ''),
            'notes': data.get('notes', ''),
            'rejection_reason': data.get('rejection_reason', ''),  # Store rejection reason
            'consultation_type': data.get('consultation_type', 'video'),  # video, chat, phone
            'urgent': data.get('urgent', False),
            'preferred_language': data.get('preferred_language', 'English'),
            'medical_history': data.get('medical_history', ''),
            'report_complaint': data.get('report_complaint', ''),
            'video_call_id': data.get('video_call_id', ''),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db[Appointment.collection_name].insert_one(appointment)
        appointment['_id'] = result.inserted_id
        return Appointment.serialize_id(appointment)
    
    @staticmethod
    def find_all(db):
        """Find all appointments"""
        appointments = list(db[Appointment.collection_name].find().sort('appointment_date', -1))
        return Appointment.serialize_list(appointments)
    
    @staticmethod
    def find_by_doctor_id(db, doctor_id):
        """Find all appointments for a specific doctor"""
        appointments = list(db[Appointment.collection_name].find({
            'doctor_id': doctor_id
        }).sort('appointment_date', -1))
        return Appointment.serialize_list(appointments)
    
    @staticmethod
    def find_pending_by_doctor_id(db, doctor_id):
        """Find pending appointments for a specific doctor"""
        appointments = list(db[Appointment.collection_name].find({
            'doctor_id': doctor_id,
            'status': 'pending'
        }).sort('appointment_date', 1))
        return Appointment.serialize_list(appointments)
    
    @staticmethod
    def find_today_by_doctor_id(db, doctor_id):
        """Find today's appointments for a specific doctor"""
        today = datetime.utcnow().date()
        start_of_day = datetime.combine(today, datetime.min.time())
        end_of_day = datetime.combine(today, datetime.max.time())
        
        appointments = list(db[Appointment.collection_name].find({
            'doctor_id': doctor_id,
            'status': {'$in': ['confirmed', 'completed', 'pending']},
            'appointment_date': {
                '$gte': start_of_day.isoformat(),
                '$lte': end_of_day.isoformat()
            }
        }).sort('appointment_date', 1))
        return Appointment.serialize_list(appointments)
    
    @staticmethod
    def find_by_patient_id(db, patient_id):
        """Find all appointments for a specific patient"""
        appointments = list(db[Appointment.collection_name].find({
            'patient_id': patient_id
        }).sort('appointment_date', -1))
        return Appointment.serialize_list(appointments)
    
    @staticmethod
    def update_status(db, appointment_id, status, rejection_reason=None):
        """Update appointment status and rejection reason if provided"""
        try:
            update_data = {
                'status': status,
                'updated_at': datetime.utcnow()
            }
            
            if rejection_reason is not None:
                update_data['rejection_reason'] = rejection_reason
            
            result = db[Appointment.collection_name].update_one(
                {'_id': ObjectId(appointment_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating appointment status: {str(e)}")
            return False
    
    @staticmethod
    def get_doctor_patients_count(db, doctor_id):
        """Get total number of unique patients for a doctor"""
        pipeline = [
            {'$match': {'doctor_id': doctor_id}},
            {'$group': {'_id': '$patient_id'}},
            {'$count': 'total_patients'}
        ]
        result = list(db[Appointment.collection_name].aggregate(pipeline))
        return result[0]['total_patients'] if result else 0
    
    @staticmethod
    def get_doctor_patients(db, doctor_id):
        """Get patients who have had appointments with a doctor"""
        try:
            pipeline = [
                {'$match': {'doctor_id': doctor_id}},
                {'$group': {'_id': '$patient_id', 'last_appointment': {'$max': '$created_at'}}},
                {'$sort': {'last_appointment': -1}}
            ]
            
            appointments = list(db[Appointment.collection_name].aggregate(pipeline))
            patients = []
            
            for appointment in appointments:
                patient = Patient.find_by_id(db, appointment['_id'])
                if patient:
                    patient['last_appointment'] = appointment['last_appointment']
                    patients.append(patient)
            
            return patients
        except Exception as e:
            print(f"Error getting doctor patients: {e}")
            return []

    @staticmethod
    def find_overdue_appointments(db, cutoff_time):
        """Find appointments that are overdue for completion"""
        try:
            # Find appointments that are confirmed but past their scheduled time
            # and haven't been completed yet
            overdue_appointments = list(db[Appointment.collection_name].find({
                'status': 'confirmed',
                'appointment_date': {'$lt': cutoff_time.isoformat()},
                '$or': [
                    {'consultation_completed': {'$exists': False}},
                    {'consultation_completed': False}
                ]
            }))
            
            return Appointment.serialize_list(overdue_appointments)
        except Exception as e:
            print(f"Error finding overdue appointments: {e}")
            return []

    @staticmethod
    def find_by_id(db, appointment_id):
        """Find appointment by ID"""
        try:
            appointment = db[Appointment.collection_name].find_one({'_id': ObjectId(appointment_id)})
            return Appointment.serialize_id(appointment) if appointment else None
        except Exception as e:
            print(f"Error finding appointment by ID: {e}")
            return None

    @staticmethod
    def get_payment_statistics(db):
        """Get payment statistics for admin dashboard"""
        try:
            total_payments = db[Payment.collection_name].count_documents({})
            completed_payments = db[Payment.collection_name].count_documents({'status': 'completed'})
            pending_payments = db[Payment.collection_name].count_documents({'status': 'processing'})
            failed_payments = db[Payment.collection_name].count_documents({'status': 'failed'})
            
            # Calculate total revenue
            pipeline = [
                {'$match': {'status': 'completed'}},
                {'$group': {'_id': None, 'total_revenue': {'$sum': '$amount'}}}
            ]
            revenue_result = list(db[Payment.collection_name].aggregate(pipeline))
            total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
            
            # Calculate revenue this month
            start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            monthly_pipeline = [
                {'$match': {'status': 'completed', 'created_at': {'$gte': start_of_month}}},
                {'$group': {'_id': None, 'monthly_revenue': {'$sum': '$amount'}}}
            ]
            monthly_result = list(db[Payment.collection_name].aggregate(monthly_pipeline))
            monthly_revenue = monthly_result[0]['monthly_revenue'] if monthly_result else 0
            
            return {
                'total_payments': total_payments,
                'completed_payments': completed_payments,
                'pending_payments': pending_payments,
                'failed_payments': failed_payments,
                'total_revenue': total_revenue,
                'monthly_revenue': monthly_revenue
            }
        except Exception as e:
            print(f"Error getting payment statistics: {e}")
            return {}

    @staticmethod
    def approve_for_release(db, payment_id):
        """Approve payment for release (sets admin_approved flag)"""
        try:
            result = db[Payment.collection_name].update_one(
                {'_id': ObjectId(payment_id)},
                {
                    '$set': {
                        'admin_approved': True,
                        'approved_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error approving payment for release: {e}")
            return False

    @staticmethod
    def generate_transaction_id():
        """Generate a unique transaction ID"""
        import random
        import string
        
        timestamp = int(datetime.utcnow().timestamp())
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"TXN{timestamp}{random_suffix}"

class User(BaseModel):
    """General user model for user management"""
    
    @staticmethod
    def find_all_users(db):
        """Find all users from different collections"""
        users = []
        
        # Get all admins
        admins = list(db['admins'].find())
        for admin in admins:
            admin['role'] = 'admin'
            users.append(admin)
        
        # Get all doctors
        doctors = list(db['doctors'].find())
        for doctor in doctors:
            doctor['role'] = 'doctor'
            users.append(doctor)
        
        # Get all patients
        patients = list(db['patients'].find())
        for patient in patients:
            patient['role'] = 'patient'
            users.append(patient)
        
        return User.serialize_list(users)
    
    @staticmethod
    def update_user_status(db, user_id, status):
        """Update user status in appropriate collection"""
        # Try to find the user in each collection
        collections = ['admins', 'doctors', 'patients']
        
        for collection in collections:
            result = db[collection].update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'status': status,
                        'is_active': status == 'active',
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            if result.modified_count > 0:
                return True
        
        return False

class SystemSettings(BaseModel):
    """System settings model"""
    collection_name = 'system_settings'
    
    @staticmethod
    def get_or_create(db):
        """Get system settings or create default ones"""
        settings = db[SystemSettings.collection_name].find_one()
        
        if not settings:
            settings = {
                'appointmentDuration': 30,
                'workingHours': {
                    'start': '09:00',
                    'end': '18:00'
                },
                'maxAppointmentsPerDay': 20,
                'maintenanceMode': False,
                'notificationSettings': {
                    'emailEnabled': True,
                    'smsEnabled': False
                },
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            result = db[SystemSettings.collection_name].insert_one(settings)
            settings['_id'] = result.inserted_id
        
        return SystemSettings.serialize_id(settings)
    
    @staticmethod
    def update(db, settings_data):
        """Update system settings"""
        settings_data['updated_at'] = datetime.utcnow()
        
        # Remove id field if present
        if 'id' in settings_data:
            del settings_data['id']
        
        result = db[SystemSettings.collection_name].update_one(
            {},
            {'$set': settings_data},
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None

class DoctorAvailability(BaseModel):
    """Doctor availability model for managing weekly schedules"""
    collection_name = 'doctor_availability'
    
    @staticmethod
    def create_default_availability():
        """Create default availability structure"""
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        availability = {}
        
        for day in days:
            availability[day] = {
                'is_available': False,
                'time_slots': []
            }
        
        return availability
    
    @staticmethod
    def create_or_update(db, doctor_id, availability_data):
        """Create or update doctor's weekly availability"""
        # Validate the data structure
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        # Ensure all days are present
        for day in days:
            if day not in availability_data:
                availability_data[day] = {
                    'is_available': False,
                    'time_slots': []
                }
        
        # Create availability document
        availability_doc = {
            'doctor_id': doctor_id,
            'weekly_availability': availability_data,
            'updated_at': datetime.utcnow()
        }
        
        # Upsert the availability (create if not exists, update if exists)
        result = db[DoctorAvailability.collection_name].update_one(
            {'doctor_id': doctor_id},
            {
                '$set': availability_doc,
                '$setOnInsert': {'created_at': datetime.utcnow()}
            },
            upsert=True
        )
        
        # Return the updated document
        updated_doc = db[DoctorAvailability.collection_name].find_one({'doctor_id': doctor_id})
        return DoctorAvailability.serialize_id(updated_doc) if updated_doc else None
    
    @staticmethod
    def find_by_doctor_id(db, doctor_id):
        """Find availability by doctor ID"""
        availability = db[DoctorAvailability.collection_name].find_one({'doctor_id': doctor_id})
        
        if not availability:
            # Create default availability if none exists
            default_availability = DoctorAvailability.create_default_availability()
            return DoctorAvailability.create_or_update(db, doctor_id, default_availability)
        
        return DoctorAvailability.serialize_id(availability)
    
    @staticmethod
    def get_available_slots_for_day(db, doctor_id, day_of_week):
        """Get available time slots for a specific day of the week"""
        availability = DoctorAvailability.find_by_doctor_id(db, doctor_id)
        
        if not availability or 'weekly_availability' not in availability:
            return []
        
        day_availability = availability['weekly_availability'].get(day_of_week.lower(), {})
        
        if not day_availability.get('is_available', False):
            return []
        
        return day_availability.get('time_slots', [])
    
    @staticmethod
    def get_available_slots_for_date(db, doctor_id, date):
        """Get available time slots for a specific date with booking status"""
        try:
            # Parse date and get day of week
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            day_of_week = date_obj.strftime('%A').lower()
            
            # Get current time for filtering past slots on current day
            now = datetime.utcnow()
            current_date = now.date()
            current_time = now.time()
            is_today = date_obj.date() == current_date
            
            # Get doctor's time slots for that day
            day_slots = DoctorAvailability.get_available_slots_for_day(db, doctor_id, day_of_week)
            
            if not day_slots:
                return []
            
            # Generate 30-minute slots from the available time ranges
            available_slots = []
            
            for slot_range in day_slots:
                start_time = slot_range.get('start_time', '')
                end_time = slot_range.get('end_time', '')
                
                if not start_time or not end_time:
                    continue
                
                # Parse start and end times
                start_hour, start_minute = map(int, start_time.split(':'))
                end_hour, end_minute = map(int, end_time.split(':'))
                
                # Generate 30-minute slots
                current_hour, current_minute = start_hour, start_minute
                
                while (current_hour < end_hour) or (current_hour == end_hour and current_minute < end_minute):
                    slot_time = f"{current_hour:02d}:{current_minute:02d}"
                    slot_datetime = f"{date}T{slot_time}:00"
                    
                    # Skip past slots if this is today
                    if is_today:
                        slot_time_obj = datetime.strptime(slot_time, '%H:%M').time()
                        # Add buffer time (e.g., 1 hour) to allow booking preparation
                        buffer_minutes = 60
                        slot_with_buffer = datetime.combine(current_date, slot_time_obj)
                        current_with_buffer = datetime.combine(current_date, current_time) + timedelta(minutes=buffer_minutes)
                        
                        if slot_with_buffer <= current_with_buffer:
                            # Skip this slot - it's too soon or has passed
                            current_minute += 30
                            if current_minute >= 60:
                                current_minute = 0
                                current_hour += 1
                            continue
                    
                    # Check if this slot is already booked
                    is_booked = DoctorAvailability.is_slot_booked(db, doctor_id, slot_datetime)
                    
                    available_slots.append({
                        'time': slot_time,
                        'datetime': slot_datetime,
                        'is_available': not is_booked,
                        'status': 'booked' if is_booked else 'available',
                        'is_past': is_today and slot_time_obj < current_time if is_today else False
                    })
                    
                    # Move to next 30-minute slot
                    current_minute += 30
                    if current_minute >= 60:
                        current_minute = 0
                        current_hour += 1
            
            return available_slots
            
        except Exception as e:
            print(f"Error getting available slots for date: {e}")
            return []
    
    @staticmethod
    def is_slot_booked(db, doctor_id, slot_datetime):
        """Check if a specific time slot is already booked"""
        try:
            # Enable debug logging in development
            debug_mode = os.getenv('FLASK_ENV') == 'development'
            
            # Normalize the slot datetime string to a consistent format
            if isinstance(slot_datetime, str):
                # Remove any timezone indicators and microseconds
                slot_datetime_clean = slot_datetime.replace('Z', '').replace('T', ' ')
                if '.' in slot_datetime_clean:
                    slot_datetime_clean = slot_datetime_clean.split('.')[0]
                
                # Ensure we have a consistent format: YYYY-MM-DD HH:MM:SS
                if ' ' not in slot_datetime_clean:
                    slot_datetime_clean = slot_datetime_clean.replace('T', ' ')
                
                # Add seconds if not present
                if len(slot_datetime_clean.split(' ')[1].split(':')) == 2:
                    slot_datetime_clean += ':00'
                    
                try:
                    slot_dt = datetime.fromisoformat(slot_datetime_clean)
                except ValueError as e:
                    if debug_mode:
                        print(f"Error parsing slot datetime '{slot_datetime}': {e}")
                    return False
            else:
                slot_dt = slot_datetime
            
            # Create the exact appointment datetime string to match against database
            appointment_datetime_iso = slot_dt.isoformat()
            
            if debug_mode:
                print(f"Checking slot booking for doctor {doctor_id} at {appointment_datetime_iso}")
            
            # Query for exact match first - appointments starting at this exact time
            exact_match_query = {
                'doctor_id': doctor_id,
                'appointment_date': appointment_datetime_iso,
                'status': {'$in': ['confirmed', 'pending']}
            }
            
            exact_match = db[Appointment.collection_name].find_one(exact_match_query)
            
            if exact_match:
                if debug_mode:
                    print(f"Exact match found: appointment {exact_match.get('_id')} at {exact_match.get('appointment_date')}")
                return True
            
            # Also check for ISO format variations that might be stored differently
            iso_variations = [
                appointment_datetime_iso,
                slot_dt.strftime('%Y-%m-%dT%H:%M:%S'),
                slot_dt.strftime('%Y-%m-%d %H:%M:%S'),
                f"{slot_dt.strftime('%Y-%m-%dT%H:%M:%S')}.000Z",
                f"{slot_dt.strftime('%Y-%m-%dT%H:%M:%S')}Z"
            ]
            
            for iso_format in iso_variations:
                variation_query = {
                    'doctor_id': doctor_id,
                    'appointment_date': iso_format,
                    'status': {'$in': ['confirmed', 'pending']}
                }
                
                match = db[Appointment.collection_name].find_one(variation_query)
                if match:
                    if debug_mode:
                        print(f"Match found with format '{iso_format}': appointment {match.get('_id')}")
                    return True
            
            # If no exact matches, check for potential overlapping appointments
            # Get all appointments for this doctor on this date
            date_only = slot_dt.date().isoformat()
            
            # Build a more flexible query to catch different datetime formats
            date_regex_pattern = f"^{date_only}"
            
            appointments_today = list(db[Appointment.collection_name].find({
                'doctor_id': doctor_id,
                'status': {'$in': ['confirmed', 'pending']},
                'appointment_date': {'$regex': date_regex_pattern}
            }))
            
            if debug_mode:
                print(f"Found {len(appointments_today)} appointments for doctor {doctor_id} on {date_only}")
                for apt in appointments_today:
                    print(f"  - Appointment {apt.get('_id')}: {apt.get('appointment_date')} (status: {apt.get('status')})")
            
            # Check each appointment for time overlap
            slot_start = slot_dt
            slot_end = slot_dt + timedelta(minutes=30)
            
            for appointment in appointments_today:
                try:
                    apt_datetime_str = appointment['appointment_date']
                    
                    # Try to parse the appointment datetime
                    apt_dt = None
                    
                    # Try different parsing approaches
                    for parse_format in [
                        '%Y-%m-%dT%H:%M:%S',
                        '%Y-%m-%d %H:%M:%S',
                        '%Y-%m-%dT%H:%M:%S.%f',
                        '%Y-%m-%dT%H:%M:%SZ',
                        '%Y-%m-%dT%H:%M:%S.%fZ'
                    ]:
                        try:
                            # Clean the datetime string first
                            clean_apt_datetime = apt_datetime_str.replace('Z', '')
                            if '.' in clean_apt_datetime and 'T' in clean_apt_datetime:
                                clean_apt_datetime = clean_apt_datetime.split('.')[0]
                            
                            apt_dt = datetime.strptime(clean_apt_datetime, parse_format.replace('.%f', ''))
                            break
                        except ValueError:
                            continue
                    
                    if not apt_dt:
                        # Try fromisoformat as last resort
                        try:
                            clean_datetime = apt_datetime_str.replace('Z', '').replace('T', ' ')
                            if '.' in clean_datetime:
                                clean_datetime = clean_datetime.split('.')[0]
                            apt_dt = datetime.fromisoformat(clean_datetime)
                        except ValueError:
                            if debug_mode:
                                print(f"Could not parse appointment datetime: {apt_datetime_str}")
                            continue
                    
                    # Check for overlap (30-minute appointment slots)
                    apt_start = apt_dt
                    apt_end = apt_dt + timedelta(minutes=30)
                    
                    # Check if the times overlap
                    if (slot_start < apt_end and slot_end > apt_start):
                        if debug_mode:
                            print(f"Time overlap detected:")
                            print(f"  Requested slot: {slot_start} - {slot_end}")
                            print(f"  Existing appointment: {apt_start} - {apt_end}")
                            print(f"  Appointment ID: {appointment.get('_id')}")
                        return True
                        
                except Exception as e:
                    if debug_mode:
                        print(f"Error processing appointment {appointment.get('_id')}: {e}")
                    continue
            
            if debug_mode:
                print(f"No conflicts found for slot {appointment_datetime_iso}")
            
            return False
            
        except Exception as e:
            print(f"Error in is_slot_booked: {e}")
            # In case of error, return False to allow booking rather than blocking
            return False
    
    @staticmethod
    def book_slot(db, doctor_id, slot_datetime, appointment_id):
        """Book a specific time slot for an appointment"""
        try:
            # Verify slot is not already booked
            if DoctorAvailability.is_slot_booked(db, doctor_id, slot_datetime):
                return False, "Time slot is already booked"
            
            # Verify the slot is within doctor's availability
            # Parse the slot datetime to extract date and time components
            if isinstance(slot_datetime, str):
                # Handle different datetime formats
                slot_datetime_clean = slot_datetime.replace('Z', '').replace('T', ' ')
                if '.' in slot_datetime_clean:
                    slot_datetime_clean = slot_datetime_clean.split('.')[0]
                
                # Ensure consistent format
                if 'T' in slot_datetime:
                    date_part, time_part = slot_datetime.split('T')
                    time_part = time_part.split('.')[0].split('Z')[0]  # Remove microseconds and timezone
                else:
                    date_part, time_part = slot_datetime_clean.split(' ')
                
                # Extract just HH:MM from the time part
                time_components = time_part.split(':')
                requested_time = f"{time_components[0]}:{time_components[1]}"
            else:
                # If it's already a datetime object
                date_part = slot_datetime.strftime('%Y-%m-%d')
                requested_time = slot_datetime.strftime('%H:%M')
            
            # Get day of week from date
            date_obj = datetime.strptime(date_part, '%Y-%m-%d')
            day_of_week = date_obj.strftime('%A').lower()
            
            # Get doctor's availability for that day
            day_slots = DoctorAvailability.get_available_slots_for_day(db, doctor_id, day_of_week)
            
            if not day_slots:
                return False, "Doctor is not available on this day"
            
            # Check if the requested time falls within any available time range
            slot_in_range = False
            for slot_range in day_slots:
                start_time = slot_range.get('start_time', '')
                end_time = slot_range.get('end_time', '')
                
                if not start_time or not end_time:
                    continue
                
                # Convert times to comparable format (minutes since midnight)
                def time_to_minutes(time_str):
                    hours, minutes = map(int, time_str.split(':'))
                    return hours * 60 + minutes
                
                start_minutes = time_to_minutes(start_time)
                end_minutes = time_to_minutes(end_time)
                requested_minutes = time_to_minutes(requested_time)
                
                # Check if requested time is within the range (inclusive start, exclusive end)
                if start_minutes <= requested_minutes < end_minutes:
                    slot_in_range = True
                    break
            
            if not slot_in_range:
                available_times = [f"{slot['start_time']}-{slot['end_time']}" for slot in day_slots]
                return False, f"Requested time {requested_time} is outside doctor's availability. Available times: {available_times}"
            
            return True, "Slot is available for booking"
            
        except Exception as e:
            print(f"Error booking slot: {e}")
            return False, f"Error processing slot booking: {str(e)}"
    
    @staticmethod
    def is_doctor_available(db, doctor_id, requested_datetime):
        """Check if doctor is available at a specific date and time"""
        # Get day of week from the requested datetime
        day_of_week = requested_datetime.strftime('%A').lower()
        
        # Get doctor's availability for that day
        available_slots = DoctorAvailability.get_available_slots_for_day(db, doctor_id, day_of_week)
        
        if not available_slots:
            return False
        
        # Get the requested time in HH:MM format
        requested_time = requested_datetime.strftime('%H:%M')
        
        # Check if the requested time falls within any available slot
        for slot in available_slots:
            start_time = slot.get('start_time', '')
            end_time = slot.get('end_time', '')
            
            if start_time <= requested_time <= end_time:
                return True
        
        return False
    
    @staticmethod
    def get_all_doctor_availabilities(db):
        """Get availability for all doctors (for admin purposes)"""
        availabilities = list(db[DoctorAvailability.collection_name].find())
        return DoctorAvailability.serialize_list(availabilities)

class Payment(BaseModel):
    """Payment model for appointment payments"""
    collection_name = 'payments'
    
    @staticmethod
    def create(db, data):
        """Create a new payment record"""
        payment = {
            'appointment_id': data.get('appointment_id'),
            'patient_id': data.get('patient_id'),
            'patient_name': data.get('patient_name'),
            'doctor_id': data.get('doctor_id'),
            'doctor_name': data.get('doctor_name'),
            'amount': float(data.get('amount', 0)),
            'currency': data.get('currency', 'INR'),
            'payment_method': data.get('payment_method', 'credit'),  # credit, debit, upi
            'payment_type': data.get('payment_type', 'consultation'),  # consultation, urgent_fee, etc.
            'status': data.get('status', 'pending'),  # pending, processing, completed, failed, refunded
            'payment_status': data.get('payment_status', 'hold'),  # hold, approved, released, cancelled
            'transaction_id': data.get('transaction_id', ''),
            'payment_gateway': data.get('payment_gateway', 'dummy'),
            'payment_data': data.get('payment_data', {}),  # Store payment form data (encrypted)
            'admin_approved': False,
            'approved_by': None,
            'approved_at': None,
            'release_date': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db[Payment.collection_name].insert_one(payment)
        payment['_id'] = result.inserted_id
        return Payment.serialize_id(payment)
    
    @staticmethod
    def find_all(db, filters=None):
        """Find all payments with optional filters"""
        query = filters or {}
        payments = list(db[Payment.collection_name].find(query).sort('created_at', -1))
        return Payment.serialize_list(payments)
    
    @staticmethod
    def find_by_id(db, payment_id):
        """Find payment by ID"""
        try:
            payment = db[Payment.collection_name].find_one({'_id': ObjectId(payment_id)})
            return Payment.serialize_id(payment) if payment else None
        except:
            return None
    
    @staticmethod
    def find_by_appointment_id(db, appointment_id):
        """Find payment by appointment ID"""
        payment = db[Payment.collection_name].find_one({'appointment_id': appointment_id})
        return Payment.serialize_id(payment) if payment else None
    
    @staticmethod
    def find_by_patient_id(db, patient_id):
        """Find all payments for a specific patient"""
        payments = list(db[Payment.collection_name].find({
            'patient_id': patient_id
        }).sort('created_at', -1))
        return Payment.serialize_list(payments)
    
    @staticmethod
    def find_by_doctor_id(db, doctor_id):
        """Find all payments for a specific doctor"""
        payments = list(db[Payment.collection_name].find({
            'doctor_id': doctor_id
        }).sort('created_at', -1))
        return Payment.serialize_list(payments)
    
    @staticmethod
    def update_status(db, payment_id, status, transaction_id=None):
        """Update payment status"""
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        if transaction_id:
            update_data['transaction_id'] = transaction_id
            
        result = db[Payment.collection_name].update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    @staticmethod
    def approve_payment(db, payment_id, admin_id, admin_name):
        """Admin approves payment for release to doctor"""
        result = db[Payment.collection_name].update_one(
            {'_id': ObjectId(payment_id)},
            {
                '$set': {
                    'admin_approved': True,
                    'payment_status': 'approved',
                    'approved_by': admin_name,
                    'approved_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def release_payment(db, payment_id):
        """Release payment to doctor"""
        result = db[Payment.collection_name].update_one(
            {'_id': ObjectId(payment_id)},
            {
                '$set': {
                    'payment_status': 'released',
                    'release_date': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def cancel_payment(db, payment_id, reason=''):
        """Cancel payment and initiate refund"""
        result = db[Payment.collection_name].update_one(
            {'_id': ObjectId(payment_id)},
            {
                '$set': {
                    'payment_status': 'cancelled',
                    'status': 'refunded',
                    'cancellation_reason': reason,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def get_payment_statistics(db):
        """Get payment statistics for admin dashboard"""
        try:
            total_payments = db[Payment.collection_name].count_documents({})
            completed_payments = db[Payment.collection_name].count_documents({'status': 'completed'})
            pending_payments = db[Payment.collection_name].count_documents({'status': 'processing'})
            failed_payments = db[Payment.collection_name].count_documents({'status': 'failed'})
            
            # Calculate total revenue
            pipeline = [
                {'$match': {'status': 'completed'}},
                {'$group': {'_id': None, 'total_revenue': {'$sum': '$amount'}}}
            ]
            revenue_result = list(db[Payment.collection_name].aggregate(pipeline))
            total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
            
            # Calculate revenue this month
            start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            monthly_pipeline = [
                {'$match': {'status': 'completed', 'created_at': {'$gte': start_of_month}}},
                {'$group': {'_id': None, 'monthly_revenue': {'$sum': '$amount'}}}
            ]
            monthly_result = list(db[Payment.collection_name].aggregate(monthly_pipeline))
            monthly_revenue = monthly_result[0]['monthly_revenue'] if monthly_result else 0
            
            return {
                'total_payments': total_payments,
                'completed_payments': completed_payments,
                'pending_payments': pending_payments,
                'failed_payments': failed_payments,
                'total_revenue': total_revenue,
                'monthly_revenue': monthly_revenue
            }
        except Exception as e:
            print(f"Error getting payment statistics: {e}")
            return {}
    
    @staticmethod
    def approve_for_release(db, payment_id):
        """Approve payment for release (sets admin_approved flag)"""
        try:
            result = db[Payment.collection_name].update_one(
                {'_id': ObjectId(payment_id)},
                {
                    '$set': {
                        'admin_approved': True,
                        'approved_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error approving payment for release: {e}")
            return False

    @staticmethod
    def generate_transaction_id():
        """Generate a unique transaction ID"""
        import random
        import string
        
        timestamp = int(datetime.utcnow().timestamp())
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"TXN{timestamp}{random_suffix}"

class WebRTCRoom(BaseModel):
    """WebRTC room model for video consultations"""
    collection_name = 'webrtc_rooms'
    
    @staticmethod
    def create(db, data):
        """Create a new WebRTC room"""
        room_data = {
            'room_id': data.get('room_id'),
            'created_at': datetime.utcnow().isoformat(),
            'created_by': data.get('created_by'),
            'appointment_id': data.get('appointment_id'),
            'status': 'active',
            'participants': [],
            'allowed_users': data.get('allowed_users', []),
            'messages': []
        }
        
        result = db[WebRTCRoom.collection_name].insert_one(room_data)
        room_id = str(result.inserted_id)
        
        # Add id field for consistency
        room_data['id'] = room_id
        
        return room_data
    
    @staticmethod
    def find_by_room_id(db, room_id):
        """Find room by room_id"""
        room = db[WebRTCRoom.collection_name].find_one({'room_id': room_id})
        if room:
            return WebRTCRoom.serialize_id(room)
        return None
    
    @staticmethod
    def find_by_appointment_id(db, appointment_id):
        """Find room by appointment_id"""
        room = db[WebRTCRoom.collection_name].find_one({'appointment_id': appointment_id})
        if room:
            return WebRTCRoom.serialize_id(room)
        return None
    
    @staticmethod
    def add_participant(db, room_id, participant_data):
        """Add participant to room"""
        result = db[WebRTCRoom.collection_name].update_one(
            {'room_id': room_id},
            {'$push': {'participants': participant_data}}
        )
        
        if result.modified_count > 0:
            return True
        return False
    
    @staticmethod
    def remove_participant(db, room_id, user_id):
        """Remove participant from room"""
        result = db[WebRTCRoom.collection_name].update_one(
            {'room_id': room_id},
            {'$pull': {'participants': {'user_id': user_id}}}
        )
        
        if result.modified_count > 0:
            return True
        return False
    
    @staticmethod
    def add_message(db, room_id, message_data):
        """Add signaling message to room"""
        result = db[WebRTCRoom.collection_name].update_one(
            {'room_id': room_id},
            {'$push': {'messages': message_data}}
        )
        
        if result.modified_count > 0:
            return True
        return False
    
    @staticmethod
    def get_messages_since(db, room_id, timestamp):
        """Get messages since timestamp"""
        room = db[WebRTCRoom.collection_name].find_one({'room_id': room_id})
        if not room:
            return []
            
        messages = room.get('messages', [])
        
        # Filter messages by timestamp
        if timestamp:
            filtered_messages = [msg for msg in messages if msg.get('timestamp', '') > timestamp]
            return filtered_messages
        
        return messages
    
    @staticmethod
    def update_status(db, room_id, status):
        """Update room status"""
        result = db[WebRTCRoom.collection_name].update_one(
            {'room_id': room_id},
            {'$set': {'status': status}}
        )
        
        if result.modified_count > 0:
            return True
        return False 