from flask import Blueprint, request, jsonify, current_app, send_file
from functools import wraps
import jwt
from datetime import datetime, timedelta
from models import Admin, Doctor, Patient, Complaint, Notification, Appointment, User, SystemSettings, DoctorAvailability, Payment, WebRTCRoom
from bson import ObjectId
from email_utils import send_otp_email, send_welcome_email, send_doctor_otp_email, send_doctor_profile_submission_email, send_doctor_verification_result_email, send_password_reset_email, send_password_reset_confirmation_email
import logging
import os
from werkzeug.utils import secure_filename
import time

logger = logging.getLogger(__name__)

# Create blueprints
auth_bp = Blueprint('auth', __name__)
admin_bp = Blueprint('admin', __name__)
doctor_bp = Blueprint('doctor', __name__)
api_bp = Blueprint('api', __name__)
patient_bp = Blueprint('patient', __name__)
payment_bp = Blueprint('payment', __name__)

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def create_upload_folder():
    """Create upload folder and subfolders if they don't exist"""
    folders = [
        UPLOAD_FOLDER,
        os.path.join(UPLOAD_FOLDER, 'doctor_documents'),
        os.path.join(UPLOAD_FOLDER, 'profile_pictures')
    ]
    for folder in folders:
        if not os.path.exists(folder):
            os.makedirs(folder)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db():
    """Get database instance from current app"""
    return current_app.config['DATABASE']

def token_required(f):
    """Decorator to require authentication token with improved error handling"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing', 'error_type': 'missing_token'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = data
            
            # Check if token is about to expire (within 30 minutes)
            exp_timestamp = data.get('exp', 0)
            current_timestamp = datetime.utcnow().timestamp()
            time_until_expiry = exp_timestamp - current_timestamp
            
            if time_until_expiry < 1800:  # 30 minutes
                # Add a header to suggest token refresh
                response_data = f(current_user, *args, **kwargs)
                if isinstance(response_data, tuple):
                    response, status_code = response_data
                    if hasattr(response, 'headers'):
                        response.headers['X-Token-Refresh-Suggested'] = 'true'
                return response_data
            
        except jwt.ExpiredSignatureError:
            return jsonify({
                'message': 'Token has expired', 
                'error_type': 'expired_token',
                'suggestion': 'Please refresh your token or login again'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'message': 'Token is invalid', 
                'error_type': 'invalid_token'
            }), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        return f(current_user, *args, **kwargs)
    
    return decorated

def doctor_required(f):
    """Decorator to require doctor role"""
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'doctor':
            return jsonify({'message': 'Doctor access required'}), 403
        return f(current_user, *args, **kwargs)
    
    return decorated

# Authentication Routes
@auth_bp.route('/ping', methods=['GET'])
def ping():
    """Health check endpoint for auth routes"""
    return jsonify({'status': 'ok', 'message': 'Auth service is running'}), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new patient"""
    try:
        data = request.get_json()
        logger.info(f"Registration request received for email: {data.get('email')}")
        
        # Check if this is a doctor registration
        if data.get('role') == 'doctor':
            return register_doctor_auth()
        
        # Validate required fields for patient
        required_fields = ['firstName', 'lastName', 'email', 'password', 'gender', 'dateOfBirth', 'phoneNumber']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Check if patient already exists
        existing_patient = Patient.find_by_email(db, data['email'])
        if existing_patient:
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new patient
        patient = Patient.create(db, data)
        logger.info(f"Patient created with ID: {patient['id']}")
        
        # Send OTP email
        email_sent = send_otp_email(
            email=patient['email'],
            otp=patient['otp'],
            name=patient['name']
        )
        
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {patient['email']}")
        
        # For development: include OTP in response
        response_data = {
            'message': 'Registration successful. Please check your email for verification code.',
            'user_id': patient['id'],
            'requires_verification': True
        }
        
        # In development mode, include OTP for testing
        if current_app.config.get('FLASK_ENV') == 'development':
            response_data['dev_otp'] = patient['otp']
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

def register_doctor_auth():
    """Register a new doctor (called from main register endpoint)"""
    try:
        data = request.get_json()
        logger.info(f"Doctor registration request received for email: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Check if doctor already exists
        existing_doctor = Doctor.find_by_email(db, data['email'])
        if existing_doctor:
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new doctor registration
        doctor = Doctor.create_registration(db, data)
        logger.info(f"Doctor created with ID: {doctor['id']}")
        
        # Send OTP email
        email_sent = send_doctor_otp_email(
            email=doctor['email'],
            otp=doctor['otp'],
            name=doctor.get('name', 'Doctor')
        )
        
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {doctor['email']}")
        
        # For development: include OTP in response
        response_data = {
            'message': 'Registration successful. Please check your email for verification code.',
            'user_id': doctor['id'],
            'requires_verification': True
        }
        
        # In development mode, include OTP for testing
        if current_app.config.get('FLASK_ENV') == 'development':
            response_data['dev_otp'] = doctor['otp']
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Doctor registration error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP and activate patient account"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        otp = data.get('otp')
        
        if not user_id or not otp:
            return jsonify({'error': 'User ID and OTP are required'}), 400
        
        db = get_db()
        
        # Verify OTP
        if Patient.verify_otp(db, user_id, otp):
            # Get updated patient data
            patient = Patient.find_by_id(db, user_id)
            if patient:
                # Generate access token
                access_token = Patient.generate_token(patient)
                
                # Send welcome email
                send_welcome_email(patient['email'], patient['name'])
                
                # Create notification for admin
                Notification.create(db, {
                    'title': 'New Patient Registration',
                    'message': f"{patient['name']} has registered as a new patient",
                    'type': 'info',
                    'userId': 'admin',
                    'relatedTo': {
                        'type': 'patient',
                        'id': patient['id']
                    }
                })
                
                return jsonify({
                    'message': 'Email verified successfully',
                    'access_token': access_token,
                    'user': {
                        'id': patient['id'],
                        'email': patient['email'],
                        'name': patient['name'],
                        'role': 'patient'
                    }
                }), 200
            else:
                return jsonify({'error': 'Patient not found'}), 404
        else:
            return jsonify({'error': 'Invalid or expired OTP'}), 400
            
    except Exception as e:
        logger.error(f"OTP verification error: {str(e)}")
        return jsonify({'error': 'Verification failed. Please try again.'}), 500

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    """Resend OTP to patient email"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        db = get_db()
        
        # Generate new OTP
        patient = Patient.resend_otp(db, user_id)
        if patient:
            # Send OTP email
            email_sent = send_otp_email(
                email=patient['email'],
                otp=patient['otp'],
                name=patient['name']
            )
            
            response_data = {
                'message': 'New verification code sent to your email'
            }
            
            # In development mode, include OTP for testing
            if current_app.config.get('FLASK_ENV') == 'development':
                response_data['dev_otp'] = patient['otp']
            
            return jsonify(response_data), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        logger.error(f"Resend OTP error: {str(e)}")
        return jsonify({'error': 'Failed to resend OTP. Please try again.'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login endpoint for all users"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400
    
    db = get_db()
    
    # Check if user is admin
    admin = Admin.find_by_email(db, email)
    if admin and Admin.verify_password(admin, password):
        token = Admin.generate_token(admin)
        return jsonify({
            'access_token': token,
            'user': {
                'id': admin['id'],
                'email': admin['email'],
                'name': admin['name'],
                'role': 'admin'
            }
        }), 200
    
    # Check if user is doctor
    doctor = Doctor.find_by_email(db, email)
    if doctor:
        # Check if email is verified
        if not doctor.get('emailVerified', False):
            return jsonify({
                'message': 'Please verify your email before logging in',
                'requires_verification': True,
                'user_id': doctor['id']
            }), 403
        
        if Doctor.verify_password(doctor, password):
            token = Doctor.generate_token(doctor)
            return jsonify({
                'access_token': token,
                'user': {
                    'id': doctor['id'],
                    'email': doctor['email'],
                    'name': doctor.get('name', 'Doctor'),
                    'role': 'doctor',
                    'verificationStatus': doctor.get('verificationStatus', 'pending'),
                    'profileCompleted': doctor.get('profileCompleted', False)
                }
            }), 200
    
    # Check if user is patient
    patient = Patient.find_by_email(db, email)
    if patient:
        # Check if email is verified
        if not patient.get('emailVerified', False):
            return jsonify({
                'message': 'Please verify your email before logging in',
                'requires_verification': True,
                'user_id': patient['id']
            }), 403
        
        if Patient.verify_password(patient, password):
            token = Patient.generate_token(patient)
            return jsonify({
                'access_token': token,
                'user': {
                    'id': patient['id'],
                    'email': patient['email'],
                    'name': patient['name'],
                    'role': 'patient'
                }
            }), 200
    
    return jsonify({'message': 'Invalid email or password'}), 401

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Send password reset email to user"""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        db = get_db()
        user = None
        user_role = None
        
        # Check which type of user this email belongs to
        admin = Admin.find_by_email(db, email)
        if admin:
            user = Admin.create_password_reset_request(db, email)
            user_role = 'admin'
        else:
            doctor = Doctor.find_by_email(db, email)
            if doctor:
                user = Doctor.create_password_reset_request(db, email)
                user_role = 'doctor'
            else:
                patient = Patient.find_by_email(db, email)
                if patient:
                    user = Patient.create_password_reset_request(db, email)
                    user_role = 'patient'
        
        # Always return success message for security (don't reveal if email exists)
        response_data = {
            'message': 'If an account with that email exists, we have sent password reset instructions.'
        }
        
        # Only send email if user was found
        if user and user_role:
            email_sent = send_password_reset_email(
                email=email,
                reset_token=user['reset_token'],
                user_name=user.get('name', ''),
                user_role=user_role
            )
            
            if not email_sent:
                logger.warning(f"Failed to send password reset email to {email}")
            else:
                logger.info(f"Password reset email sent successfully to {email} ({user_role})")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return jsonify({'error': 'Failed to process password reset request. Please try again.'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using reset token"""
    try:
        data = request.get_json()
        email = data.get('email')
        reset_token = data.get('reset_token')
        new_password = data.get('new_password')
        
        if not email or not reset_token or not new_password:
            return jsonify({'error': 'Email, reset token, and new password are required'}), 400
        
        # Basic password validation
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        db = get_db()
        reset_successful = False
        user_role = None
        user_name = None
        
        # Try to reset password for each user type
        admin = Admin.verify_reset_token(db, email, reset_token)
        if admin:
            reset_successful = Admin.reset_password(db, email, reset_token, new_password)
            user_role = 'admin'
            user_name = admin.get('name', '')
        else:
            doctor = Doctor.verify_reset_token(db, email, reset_token)
            if doctor:
                reset_successful = Doctor.reset_password(db, email, reset_token, new_password)
                user_role = 'doctor'
                user_name = doctor.get('name', '')
            else:
                patient = Patient.verify_reset_token(db, email, reset_token)
                if patient:
                    reset_successful = Patient.reset_password(db, email, reset_token, new_password)
                    user_role = 'patient'
                    user_name = patient.get('name', '')
        
        if not reset_successful:
            return jsonify({'error': 'Invalid or expired reset token'}), 400
        
        # Send confirmation email
        if user_role:
            send_password_reset_confirmation_email(
                email=email,
                user_name=user_name,
                user_role=user_role
            )
        
        logger.info(f"Password reset successful for {email} ({user_role})")
        
        return jsonify({
            'message': 'Password has been reset successfully. You can now log in with your new password.',
            'success': True
        }), 200
        
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        return jsonify({'error': 'Failed to reset password. Please try again.'}), 500

@auth_bp.route('/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verify if a reset token is valid (for frontend validation)"""
    try:
        data = request.get_json()
        email = data.get('email')
        reset_token = data.get('reset_token')
        
        if not email or not reset_token:
            return jsonify({'error': 'Email and reset token are required'}), 400
        
        db = get_db()
        
        # Check if token is valid for any user type
        valid_token = False
        user_role = None
        
        admin = Admin.verify_reset_token(db, email, reset_token)
        if admin:
            valid_token = True
            user_role = 'admin'
        else:
            doctor = Doctor.verify_reset_token(db, email, reset_token)
            if doctor:
                valid_token = True
                user_role = 'doctor'
            else:
                patient = Patient.verify_reset_token(db, email, reset_token)
                if patient:
                    valid_token = True
                    user_role = 'patient'
        
        if valid_token:
            return jsonify({
                'valid': True,
                'user_role': user_role,
                'message': 'Reset token is valid'
            }), 200
        else:
            return jsonify({
                'valid': False,
                'message': 'Invalid or expired reset token'
            }), 400
        
    except Exception as e:
        logger.error(f"Verify reset token error: {str(e)}")
        return jsonify({'error': 'Failed to verify reset token'}), 500

@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_token():
    """Refresh an existing token to extend session"""
    try:
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Decode token even if expired (for refresh)
            data = jwt.decode(
                token, 
                current_app.config['JWT_SECRET_KEY'], 
                algorithms=['HS256'],
                options={"verify_exp": False}  # Don't verify expiration for refresh
            )
            
            user_id = data.get('id')
            user_email = data.get('email')
            user_role = data.get('role')
            
            if not user_id or not user_email or not user_role:
                return jsonify({'error': 'Invalid token data'}), 401
                
            db = get_db()
            
            # Verify user still exists and is active
            if user_role == 'admin':
                user = Admin.find_by_email(db, user_email)
            elif user_role == 'doctor':
                user = Doctor.find_by_email(db, user_email)
            elif user_role == 'patient':
                user = Patient.find_by_email(db, user_email)
            else:
                return jsonify({'error': 'Invalid user role'}), 401
            
            if not user:
                return jsonify({'error': 'User no longer exists'}), 401
            
            # Generate new token
            if user_role == 'admin':
                new_token = Admin.generate_token(user)
            elif user_role == 'doctor':
                new_token = Doctor.generate_token(user)
            elif user_role == 'patient':
                new_token = Patient.generate_token(user)
            
            return jsonify({
                'access_token': new_token,
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'name': user.get('name', ''),
                    'role': user_role
                },
                'message': 'Token refreshed successfully'
            }), 200
            
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid and cannot be refreshed'}), 401
            
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({'error': 'Failed to refresh token'}), 500

@auth_bp.route('/validate-session', methods=['GET'])
@token_required
def validate_session(current_user):
    """Validate current session and return user info"""
    try:
        return jsonify({
            'valid': True,
            'user': {
                'id': current_user.get('id'),
                'email': current_user.get('email'),
                'role': current_user.get('role')
            },
            'expires_at': current_user.get('exp')
        }), 200
    except Exception as e:
        logger.error(f"Session validation error: {str(e)}")
        return jsonify({'error': 'Session validation failed'}), 500

# Admin Dashboard Routes
@admin_bp.route('/dashboard/stats', methods=['GET'])
@admin_required
def get_dashboard_stats(current_user):
    """Get admin dashboard statistics"""
    db = get_db()
    
    # Get counts from database
    total_doctors = db.doctors.count_documents({})
    pending_verifications = db.doctors.count_documents({'verificationStatus': 'admin_pending'})
    total_patients = db.patients.count_documents({})
    total_complaints = db.complaints.count_documents({})
    new_complaints = db.complaints.count_documents({'status': 'new'})
    high_priority_complaints = db.complaints.count_documents({'severity': 'high', 'status': {'$ne': 'resolved'}})
    
    # Calculate monthly stats
    current_month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_doctors_this_month = db.doctors.count_documents({'created_at': {'$gte': current_month_start}})
    new_patients_this_month = db.patients.count_documents({'created_at': {'$gte': current_month_start}})
    
    return jsonify({
        'totalDoctors': total_doctors,
        'pendingVerifications': pending_verifications,
        'totalPatients': total_patients,
        'totalComplaints': total_complaints,
        'newComplaints': new_complaints,
        'newDoctorsThisMonth': new_doctors_this_month,
        'newPatientsThisMonth': new_patients_this_month,
        'highPriorityComplaints': high_priority_complaints
    }), 200

@admin_bp.route('/profile', methods=['GET'])
@admin_required
def get_admin_profile(current_user):
    """Get admin profile"""
    db = get_db()
    admin = db.admins.find_one({'_id': ObjectId(current_user['id'])})
    
    if not admin:
        return jsonify({'message': 'Admin not found'}), 404
    
    return jsonify(Admin.serialize_id(admin)), 200

# Doctor Management Routes
@admin_bp.route('/doctors', methods=['GET'])
@admin_required
def get_all_doctors(current_user):
    """Get all doctors for admin"""
    db = get_db()
    doctors = Doctor.find_all(db)
    return jsonify(doctors), 200

@admin_bp.route('/doctors/pending-verification', methods=['GET'])
@admin_required
def get_pending_verification_doctors(current_user):
    """Get doctors pending admin verification"""
    db = get_db()
    pending_doctors = Doctor.find_all(db, filters={'verificationStatus': 'admin_pending'})
    return jsonify(pending_doctors), 200

@admin_bp.route('/doctors/<doctor_id>', methods=['GET'])
@admin_required
def get_doctor_details(current_user, doctor_id):
    """Get doctor details"""
    db = get_db()
    doctor = Doctor.find_by_id(db, doctor_id)
    
    if not doctor:
        return jsonify({'message': 'Doctor not found'}), 404
    
    return jsonify(doctor), 200

@admin_bp.route('/doctors/<doctor_id>/verify', methods=['PUT'])
@admin_required
def verify_doctor(current_user, doctor_id):
    """Verify or reject doctor"""
    data = request.get_json()
    approved = data.get('approved', False)
    
    db = get_db()
    
    # Get doctor details before updating
    doctor = Doctor.find_by_id(db, doctor_id)
    if not doctor:
        return jsonify({'message': 'Doctor not found'}), 404
    
    success = Doctor.update_verification_status(db, doctor_id, approved)
    
    if not success:
        return jsonify({'message': 'Failed to update doctor verification status'}), 400
    
    # Send verification result email
    send_doctor_verification_result_email(doctor['email'], doctor.get('name', 'Doctor'), approved)
    
    # Create notification
    Notification.create(db, {
        'title': 'Doctor Verification',
        'message': f"Doctor {doctor.get('name', 'Unknown')} has been {'approved' if approved else 'rejected'}",
        'type': 'info',
        'userId': 'admin',
        'relatedTo': {
            'type': 'doctor',
            'id': doctor_id
        }
    })
    
    return jsonify({
        'message': f"Doctor has been {'approved' if approved else 'rejected'} successfully",
        'success': True
    }), 200

@admin_bp.route('/doctors/<doctor_id>', methods=['DELETE'])
@admin_required
def remove_doctor(current_user, doctor_id):
    """Remove a doctor"""
    db = get_db()
    success = Doctor.delete(db, doctor_id)
    
    if not success:
        return jsonify({'message': 'Failed to remove doctor'}), 400
    
    return jsonify({'message': 'Doctor removed successfully'}), 200

# Patient Management Routes
@admin_bp.route('/patients', methods=['GET'])
@admin_required
def get_all_patients(current_user):
    """Get all patients"""
    db = get_db()
    patients = Patient.find_all(db)
    return jsonify(patients), 200

@admin_bp.route('/patients/<patient_id>', methods=['GET'])
@admin_required
def get_patient_details(current_user, patient_id):
    """Get patient details"""
    db = get_db()
    patient = Patient.find_by_id(db, patient_id)
    
    if not patient:
        return jsonify({'message': 'Patient not found'}), 404
    
    return jsonify(patient), 200

@admin_bp.route('/patients/<patient_id>/status', methods=['PUT'])
@admin_required
def update_patient_status(current_user, patient_id):
    """Update patient status"""
    data = request.get_json()
    status = data.get('status')
    
    if not status:
        return jsonify({'message': 'Status is required'}), 400
    
    db = get_db()
    success = Patient.update_status(db, patient_id, status)
    
    if not success:
        return jsonify({'message': 'Failed to update patient status'}), 400
    
    return jsonify({'message': 'Patient status updated successfully'}), 200

# Complaint Management Routes
@admin_bp.route('/complaints', methods=['GET'])
@admin_required
def get_all_complaints(current_user):
    """Get all complaints"""
    db = get_db()
    complaints = Complaint.find_all(db)
    return jsonify(complaints), 200

@admin_bp.route('/complaints/<complaint_id>/status', methods=['PUT'])
@admin_required
def update_complaint_status(current_user, complaint_id):
    """Update complaint status"""
    data = request.get_json()
    status = data.get('status')
    notes = data.get('notes')
    
    if not status:
        return jsonify({'message': 'Status is required'}), 400
    
    db = get_db()
    success = Complaint.update_status(db, complaint_id, status, notes)
    
    if not success:
        return jsonify({'message': 'Failed to update complaint status'}), 400
    
    # Create notification
    Notification.create(db, {
        'title': 'Complaint Status Updated',
        'message': f"Complaint #{complaint_id} status changed to {status}",
        'type': 'info',
        'userId': 'admin',
        'relatedTo': {
            'type': 'complaint',
            'id': complaint_id
        }
    })
    
    return jsonify({'message': 'Complaint status updated successfully'}), 200

# User Management Routes
@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_all_users(current_user):
    """Get all users across all roles"""
    db = get_db()
    users = User.find_all_users(db)
    return jsonify(users), 200

@admin_bp.route('/users/<user_id>/status', methods=['PUT'])
@admin_required
def update_user_status(current_user, user_id):
    """Update user status"""
    data = request.get_json()
    status = data.get('status')
    
    if not status:
        return jsonify({'message': 'Status is required'}), 400
    
    db = get_db()
    success = User.update_user_status(db, user_id, status)
    
    if not success:
        return jsonify({'message': 'Failed to update user status'}), 400
    
    return jsonify({'message': 'User status updated successfully'}), 200

# Appointment Management Routes
@admin_bp.route('/appointments', methods=['GET'])
@admin_required
def get_all_appointments(current_user):
    """Get all appointments"""
    db = get_db()
    appointments = Appointment.find_all(db)
    return jsonify(appointments), 200

# Consultation History Management Routes
@admin_bp.route('/consultations/history', methods=['GET'])
@admin_required
def get_consultation_history(current_user):
    """Get consultation history with payment status for admin dashboard"""
    try:
        db = get_db()
        
        # Get all appointments with extended information
        appointments = list(db.appointments.find({}).sort('created_at', -1))
        consultation_history = []
        
        for appointment in appointments:
            # Get payment information for this appointment
            payment = Payment.find_by_appointment_id(db, appointment.get('_id'))
            
            # Get doctor and patient names
            doctor = Doctor.find_by_id(db, appointment.get('doctor_id'))
            patient = Patient.find_by_id(db, appointment.get('patient_id'))
            
            # Format consultation data
            consultation = {
                'id': str(appointment['_id']),
                'patientName': patient.get('name', 'Unknown Patient') if patient else 'Unknown Patient',
                'doctorName': doctor.get('name', 'Unknown Doctor') if doctor else 'Unknown Doctor',
                'appointmentDate': appointment.get('appointment_date', '').split('T')[0] if appointment.get('appointment_date') else '',
                'appointmentTime': appointment.get('appointment_date', '').split('T')[1][:5] if appointment.get('appointment_date') and 'T' in appointment.get('appointment_date', '') else '',
                'consultationType': appointment.get('consultation_type', 'video'),
                'status': appointment.get('status', 'pending'),
                'paymentStatus': payment.get('payment_status', 'pending') if payment else 'pending',
                'amount': payment.get('amount', 0) if payment else 0,
                'reason': appointment.get('reason', ''),
                'notes': appointment.get('notes', ''),
                'paymentDate': payment.get('created_at', '') if payment else '',
                'paymentMethod': payment.get('payment_method', '') if payment else '',
                'transactionId': payment.get('transaction_id', '') if payment else ''
            }
            
            consultation_history.append(consultation)
        
        return jsonify(consultation_history), 200
        
    except Exception as e:
        logger.error(f"Get consultation history error: {str(e)}")
        return jsonify({'error': 'Failed to get consultation history'}), 500

# Notification Routes
@admin_bp.route('/notifications', methods=['GET'])
@admin_required
def get_notifications(current_user):
    """Get admin notifications"""
    db = get_db()
    notifications = Notification.find_admin_notifications(db)
    return jsonify(notifications), 200

@admin_bp.route('/notifications/<notification_id>/read', methods=['PUT'])
@admin_required
def mark_notification_read(current_user, notification_id):
    """Mark notification as read"""
    db = get_db()
    success = Notification.mark_as_read(db, notification_id)
    
    if not success:
        return jsonify({'message': 'Failed to mark notification as read'}), 400
    
    return jsonify({'message': 'Notification marked as read'}), 200

@admin_bp.route('/notifications/read-all', methods=['PUT'])
@admin_required
def mark_all_notifications_read(current_user):
    """Mark all notifications as read"""
    db = get_db()
    count = Notification.mark_all_as_read(db)
    
    return jsonify({
        'message': f'{count} notifications marked as read',
        'count': count
    }), 200

# System Settings Routes
@admin_bp.route('/settings', methods=['GET'])
@admin_required
def get_system_settings(current_user):
    """Get system settings"""
    db = get_db()
    settings = SystemSettings.get_or_create(db)
    return jsonify(settings), 200

@admin_bp.route('/settings', methods=['PUT'])
@admin_required
def update_system_settings(current_user):
    """Update system settings"""
    data = request.get_json()
    db = get_db()
    
    success = SystemSettings.update(db, data)
    
    if not success:
        return jsonify({'message': 'Failed to update system settings'}), 400
    
    return jsonify({'message': 'System settings updated successfully'}), 200

# Public API Routes (for frontend)
@api_bp.route('/doctors', methods=['GET'])
def get_approved_doctors():
    """Get all approved doctors (public endpoint)"""
    db = get_db()
    doctors = Doctor.find_all(db, filters={'verificationStatus': 'approved'})
    return jsonify(doctors), 200

@api_bp.route('/doctors/<doctor_id>/availability', methods=['GET'])
def get_doctor_availability_public(doctor_id):
    """Get doctor's availability for appointment booking (public endpoint)"""
    try:
        db = get_db()
        
        # Verify doctor exists and is approved
        doctor = Doctor.find_by_id(db, doctor_id)
        if not doctor or doctor.get('verificationStatus') != 'approved':
            return jsonify({'error': 'Doctor not found or not available'}), 404
        
        # Get availability for this doctor
        availability = DoctorAvailability.find_by_doctor_id(db, doctor_id)
        
        return jsonify({
            'doctor_id': doctor_id,
            'doctor_name': doctor.get('name', 'Unknown'),
            'availability': availability,
            'success': True
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor availability public error: {str(e)}")
        return jsonify({'error': 'Failed to fetch doctor availability'}), 500

@api_bp.route('/doctors/<doctor_id>/availability/date/<date>', methods=['GET'])
def get_doctor_availability_for_date(doctor_id, date):
    """Get doctor's available time slots for a specific date (public endpoint)"""
    try:
        db = get_db()
        
        # Verify doctor exists and is approved
        doctor = Doctor.find_by_id(db, doctor_id)
        if not doctor or doctor.get('verificationStatus') != 'approved':
            return jsonify({'error': 'Doctor not found or not available'}), 404
        
        # Parse date and get day of week
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            day_of_week = date_obj.strftime('%A').lower()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Get available slots with booking status for the specified date
        available_slots = DoctorAvailability.get_available_slots_for_date(
            db, 
            doctor_id, 
            date
        )
        
        return jsonify({
            'doctor_id': doctor_id,
            'doctor_name': doctor.get('name', 'Unknown'),
            'date': date,
            'day_of_week': day_of_week,
            'available_slots': available_slots,
            'total_slots': len(available_slots),
            'available_count': len([slot for slot in available_slots if slot['is_available']]),
            'booked_count': len([slot for slot in available_slots if not slot['is_available']]),
            'success': True
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor availability for date error: {str(e)}")
        return jsonify({'error': 'Failed to fetch availability for the specified date'}), 500

@api_bp.route('/doctors/<doctor_id>/slots/check', methods=['POST'])
def check_slot_availability(doctor_id):
    """Check if a specific time slot is available for booking"""
    try:
        data = request.get_json()
        slot_datetime = data.get('slot_datetime')
        
        if not slot_datetime:
            return jsonify({'error': 'slot_datetime is required'}), 400
        
        db = get_db()
        
        # Verify doctor exists and is approved
        doctor = Doctor.find_by_id(db, doctor_id)
        if not doctor or doctor.get('verificationStatus') != 'approved':
            return jsonify({'error': 'Doctor not found or not available'}), 404
        
        # Check slot availability
        is_available, message = DoctorAvailability.book_slot(db, doctor_id, slot_datetime, None)
        is_booked = DoctorAvailability.is_slot_booked(db, doctor_id, slot_datetime)
        
        return jsonify({
            'doctor_id': doctor_id,
            'slot_datetime': slot_datetime,
            'is_available': is_available and not is_booked,
            'is_booked': is_booked,
            'message': message,
            'status': 'available' if (is_available and not is_booked) else 'booked',
            'debug_info': {
                'within_availability': is_available,
                'slot_booked': is_booked,
                'availability_message': message
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Check slot availability error: {str(e)}")
        return jsonify({'error': 'Failed to check slot availability'}), 500

@api_bp.route('/doctors/<doctor_id>/slots/debug', methods=['GET'])
def debug_doctor_slots(doctor_id):
    """Debug endpoint to check all appointments for a doctor on a specific date"""
    try:
        date = request.args.get('date')
        if not date:
            return jsonify({'error': 'date parameter is required (YYYY-MM-DD)'}), 400
        
        db = get_db()
        
        # Get all appointments for this doctor on this date
        day_start = f"{date}T00:00:00"
        day_end = f"{date}T23:59:59"
        
        appointments = list(db[Appointment.collection_name].find({
            'doctor_id': doctor_id,
            'appointment_date': {
                '$gte': day_start,
                '$lte': day_end
            }
        }))
        
        # Get doctor availability for this date
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        day_of_week = date_obj.strftime('%A').lower()
        
        day_slots = DoctorAvailability.get_available_slots_for_day(db, doctor_id, day_of_week)
        available_slots = DoctorAvailability.get_available_slots_for_date(db, doctor_id, date)
        
        return jsonify({
            'doctor_id': doctor_id,
            'date': date,
            'day_of_week': day_of_week,
            'total_appointments': len(appointments),
            'appointments': [Appointment.serialize_id(apt) for apt in appointments],
            'doctor_availability': day_slots,
            'generated_slots': available_slots,
            'debug_summary': {
                'has_availability': len(day_slots) > 0,
                'total_generated_slots': len(available_slots),
                'available_count': len([s for s in available_slots if s['is_available']]),
                'booked_count': len([s for s in available_slots if not s['is_available']])
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Debug doctor slots error: {str(e)}")
        return jsonify({'error': 'Failed to debug doctor slots'}), 500

@api_bp.route('/doctors/<doctor_id>/slots/validate', methods=['POST'])
def validate_slot_booking(doctor_id):
    """Detailed validation endpoint to debug slot booking issues"""
    try:
        data = request.get_json()
        slot_datetime = data.get('slot_datetime')
        
        if not slot_datetime:
            return jsonify({'error': 'slot_datetime is required'}), 400
        
        db = get_db()
        
        # Verify doctor exists and is approved
        doctor = Doctor.find_by_id(db, doctor_id)
        if not doctor or doctor.get('verificationStatus') != 'approved':
            return jsonify({'error': 'Doctor not found or not available'}), 404
        
        # Detailed slot validation
        is_booked = DoctorAvailability.is_slot_booked(db, doctor_id, slot_datetime)
        is_available, availability_message = DoctorAvailability.book_slot(db, doctor_id, slot_datetime, None)
        
        # Get all appointments for this doctor to help debug
        try:
            # Parse the requested slot datetime
            if isinstance(slot_datetime, str):
                slot_datetime_clean = slot_datetime.replace('Z', '').replace('T', ' ')
                if '.' in slot_datetime_clean:
                    slot_datetime_clean = slot_datetime_clean.split('.')[0]
                if len(slot_datetime_clean.split(' ')[1].split(':')) == 2:
                    slot_datetime_clean += ':00'
                slot_dt = datetime.fromisoformat(slot_datetime_clean)
            
            date_only = slot_dt.date().isoformat()
            
            # Get all appointments for this doctor on this date
            all_appointments = list(db[Appointment.collection_name].find({
                'doctor_id': doctor_id,
                'appointment_date': {'$regex': f'^{date_only}'}
            }))
            
            confirmed_appointments = [apt for apt in all_appointments if apt.get('status') in ['confirmed', 'pending']]
            
        except Exception as e:
            slot_dt = None
            date_only = None
            all_appointments = []
            confirmed_appointments = []
        
        return jsonify({
            'doctor_id': doctor_id,
            'doctor_name': doctor.get('name', 'Unknown'),
            'slot_datetime': slot_datetime,
            'slot_date': date_only,
            'validation_results': {
                'is_booked': is_booked,
                'is_within_availability': is_available,
                'availability_message': availability_message,
                'final_status': 'available' if (is_available and not is_booked) else 'not_available'
            },
            'debug_info': {
                'total_appointments_on_date': len(all_appointments),
                'confirmed_appointments_on_date': len(confirmed_appointments),
                'all_appointments': [
                    {
                        'id': str(apt.get('_id')),
                        'appointment_date': apt.get('appointment_date'),
                        'status': apt.get('status'),
                        'patient_name': apt.get('patient_name')
                    } for apt in all_appointments
                ],
                'confirmed_appointments': [
                    {
                        'id': str(apt.get('_id')),
                        'appointment_date': apt.get('appointment_date'),
                        'status': apt.get('status'),
                        'patient_name': apt.get('patient_name')
                    } for apt in confirmed_appointments
                ]
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Validate slot booking error: {str(e)}")
        return jsonify({'error': 'Failed to validate slot booking', 'details': str(e)}), 500

@doctor_bp.route('/register', methods=['POST'])
def register_doctor():
    """Register a new doctor"""
    try:
        data = request.get_json()
        logger.info(f"Doctor registration request received for email: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['firstName', 'lastName', 'email', 'password', 'gender', 'dateOfBirth', 'phoneNumber']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Check if doctor already exists
        existing_doctor = Doctor.find_by_email(db, data['email'])
        if existing_doctor:
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new doctor
        doctor = Doctor.create(db, data)
        logger.info(f"Doctor created with ID: {doctor['id']}")
        
        # Send OTP email
        email_sent = send_doctor_otp_email(
            email=doctor['email'],
            otp=doctor['otp'],
            name=doctor['name']
        )
        
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {doctor['email']}")
        
        # For development: include OTP in response
        response_data = {
            'message': 'Registration successful. Please check your email for verification code.',
            'user_id': doctor['id']
        }
        
        # In development mode, include OTP for testing
        if current_app.config.get('FLASK_ENV') == 'development':
            response_data['dev_otp'] = doctor['otp']
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Doctor registration error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

@doctor_bp.route('/verify-otp', methods=['POST'])
def verify_doctor_otp():
    """Verify OTP and activate doctor account"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        otp = data.get('otp')
        
        logger.info(f"Doctor OTP verification attempt - User ID: {user_id}, OTP: {otp}")
        
        if not user_id or not otp:
            return jsonify({'error': 'User ID and OTP are required'}), 400
        
        db = get_db()
        
        # Debug: Check if doctor exists and get current OTP info
        try:
            doctor_check = db[Doctor.collection_name].find_one({'_id': ObjectId(user_id)})
            if doctor_check:
                logger.info(f"Doctor found - Email: {doctor_check.get('email')}, Stored OTP: {doctor_check.get('otp')}, Expires: {doctor_check.get('otpExpiresAt')}")
            else:
                logger.warning(f"Doctor not found with ID: {user_id}")
        except Exception as e:
            logger.error(f"Error checking doctor: {str(e)}")
        
        # Verify OTP
        if Doctor.verify_otp(db, user_id, otp):
            # Get updated doctor data
            doctor = Doctor.find_by_id(db, user_id)
            if doctor:
                logger.info(f"Doctor OTP verification successful for: {doctor['email']}")
                # Generate access token
                access_token = Doctor.generate_token(doctor)
                
                # Send welcome email
                send_doctor_profile_submission_email(doctor['email'], doctor.get('name', 'Doctor'))
                
                # Create notification for admin
                Notification.create(db, {
                    'title': 'New Doctor Registration',
                    'message': f"{doctor.get('name', 'Doctor')} has registered as a new doctor",
                    'type': 'info',
                    'userId': 'admin',
                    'relatedTo': {
                        'type': 'doctor',
                        'id': doctor['id']
                    }
                })
                
                return jsonify({
                    'message': 'Email verified successfully',
                    'access_token': access_token,
                    'user': {
                        'id': doctor['id'],
                        'email': doctor['email'],
                        'name': doctor.get('name', 'Doctor'),
                        'role': 'doctor'
                    }
                }), 200
            else:
                logger.error(f"Doctor not found after OTP verification: {user_id}")
                return jsonify({'error': 'Doctor not found'}), 404
        else:
            logger.warning(f"Doctor OTP verification failed - User ID: {user_id}, OTP: {otp}")
            return jsonify({'error': 'Invalid or expired OTP'}), 400
            
    except Exception as e:
        logger.error(f"Doctor OTP verification error: {str(e)}")
        return jsonify({'error': 'Verification failed. Please try again.'}), 500

@doctor_bp.route('/resend-otp', methods=['POST'])
def resend_doctor_otp():
    """Resend OTP to doctor email"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        db = get_db()
        
        # Generate new OTP
        doctor = Doctor.resend_otp(db, user_id)
        if doctor:
            # Send OTP email
            email_sent = send_doctor_otp_email(
                email=doctor['email'],
                otp=doctor['otp'],
                name=doctor['name']
            )
            
            response_data = {
                'message': 'New verification code sent to your email'
            }
            
            # In development mode, include OTP for testing
            if current_app.config.get('FLASK_ENV') == 'development':
                response_data['dev_otp'] = doctor['otp']
            
            return jsonify(response_data), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        logger.error(f"Resend OTP error: {str(e)}")
        return jsonify({'error': 'Failed to resend OTP. Please try again.'}), 500

@doctor_bp.route('/create-profile', methods=['POST'])
@doctor_required
def create_doctor_profile(current_user):
    """Create doctor profile after email verification"""
    try:
        # Create upload folder if it doesn't exist
        create_upload_folder()
        
        # Get form data
        profile_data = {
            'firstName': request.form.get('firstName'),
            'lastName': request.form.get('lastName'),
            'phoneNumber': request.form.get('phoneNumber'),
            'specialty': request.form.get('specialty'),
            'experienceYears': request.form.get('experienceYears'),
            'consultationFee': request.form.get('consultationFee'),
            'bio': request.form.get('bio', '')
        }
        
        # Validate required fields
        required_fields = ['firstName', 'lastName', 'phoneNumber', 'specialty', 'experienceYears', 'consultationFee']
        for field in required_fields:
            if not profile_data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Handle file uploads
        document_paths = {}
        
        # Medical License
        if 'medicalLicense' in request.files:
            file = request.files['medicalLicense']
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(f"medical_license_{current_user['id']}_{file.filename}")
                file_path = os.path.join(UPLOAD_FOLDER, 'doctor_documents', filename)
                file.save(file_path)
                document_paths['medical_license'] = file_path
            elif file and file.filename:
                return jsonify({'error': 'Medical license file type not allowed'}), 400
        
        # MBBS Certificate
        if 'mbbsCertificate' in request.files:
            file = request.files['mbbsCertificate']
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(f"mbbs_certificate_{current_user['id']}_{file.filename}")
                file_path = os.path.join(UPLOAD_FOLDER, 'doctor_documents', filename)
                file.save(file_path)
                document_paths['mbbs_certificate'] = file_path
            elif file and file.filename:
                return jsonify({'error': 'MBBS certificate file type not allowed'}), 400
        
        # Validate that both documents are uploaded
        if not document_paths.get('medical_license'):
            return jsonify({'error': 'Medical license is required'}), 400
        if not document_paths.get('mbbs_certificate'):
            return jsonify({'error': 'MBBS certificate is required'}), 400
        
        db = get_db()
        
        # Create/update doctor profile
        doctor = Doctor.create_profile(db, current_user['id'], profile_data, document_paths)
        
        if not doctor:
            return jsonify({'error': 'Failed to create profile'}), 500
        
        # Send profile submission email
        send_doctor_profile_submission_email(doctor['email'], doctor['name'])
        
        # Create notification for admin
        Notification.create(db, {
            'title': 'Doctor Profile Submitted',
            'message': f"Dr. {doctor['name']} has completed their profile and uploaded credentials",
            'type': 'info',
            'userId': 'admin',
            'relatedTo': {
                'type': 'doctor',
                'id': doctor['id']
            }
        })
        
        return jsonify({
            'message': 'Profile created successfully. Awaiting admin verification.',
            'doctor': {
                'id': doctor['id'],
                'name': doctor['name'],
                'specialty': doctor['specialty'],
                'verificationStatus': doctor['verificationStatus'],
                'profileCompleted': doctor['profileCompleted']
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Doctor profile creation error: {str(e)}")
        return jsonify({'error': 'Profile creation failed. Please try again.'}), 500

@doctor_bp.route('/profile', methods=['GET'])
@doctor_required
def get_doctor_profile(current_user):
    """Get current doctor's profile"""
    try:
        db = get_db()
        doctor = Doctor.find_by_id(db, current_user['id'])
        
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        # Remove sensitive information
        if 'password' in doctor:
            del doctor['password']
        if 'otp' in doctor:
            del doctor['otp']
            
        return jsonify(doctor), 200
        
    except Exception as e:
        logger.error(f"Get doctor profile error: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500

@doctor_bp.route('/profile', methods=['PUT'])
@doctor_required
def update_doctor_profile(current_user):
    """Update doctor profile with optional photo upload"""
    try:
        # Create upload folder if it doesn't exist
        create_upload_folder()
        
        db = get_db()
        
        # Get current doctor data
        doctor = Doctor.find_by_id(db, current_user['id'])
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        update_data = {}
        
        # Handle form data (for multipart/form-data requests)
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Get form fields
            if request.form.get('first_name'):
                update_data['first_name'] = request.form.get('first_name')
            if request.form.get('last_name'):
                update_data['last_name'] = request.form.get('last_name')
            if request.form.get('phone'):
                update_data['phone'] = request.form.get('phone')
            if request.form.get('specialty'):
                update_data['specialty'] = request.form.get('specialty')
            if request.form.get('experience_years'):
                update_data['experience_years'] = int(request.form.get('experience_years'))
            if request.form.get('consultationFee'):
                update_data['consultationFee'] = float(request.form.get('consultationFee'))
            if request.form.get('bio'):
                update_data['bio'] = request.form.get('bio')
            
            # Handle profile picture upload
            if 'profile_picture' in request.files:
                file = request.files['profile_picture']
                if file and file.filename and allowed_file(file.filename):
                    # Validate file size (5MB max)
                    if file.content_length and file.content_length > 5 * 1024 * 1024:
                        return jsonify({'error': 'File size exceeds 5MB limit'}), 400
                    
                    filename = secure_filename(f"profile_{current_user['id']}_{file.filename}")
                    file_path = os.path.join(UPLOAD_FOLDER, 'profile_pictures', filename)
                    
                    # Create profile pictures subfolder if it doesn't exist
                    profile_pics_folder = os.path.join(UPLOAD_FOLDER, 'profile_pictures')
                    if not os.path.exists(profile_pics_folder):
                        os.makedirs(profile_pics_folder)
                    
                    file.save(file_path)
                    update_data['profile_picture'] = f"/api/uploads/profile_pictures/{filename}"
                elif file and file.filename:
                    return jsonify({'error': 'Profile picture file type not allowed'}), 400
        
        # Handle JSON data (for application/json requests)
        else:
            data = request.get_json()
            if data:
                for field in ['first_name', 'last_name', 'phone', 'specialty', 'experience_years', 'consultationFee', 'bio']:
                    if field in data and data[field] is not None:
                        if field in ['experience_years', 'consultationFee']:
                            try:
                                update_data[field] = float(data[field]) if field == 'consultationFee' else int(data[field])
                            except (ValueError, TypeError):
                                continue
                        else:
                            update_data[field] = data[field]
        
        # Update name field if first_name or last_name changed
        if 'first_name' in update_data or 'last_name' in update_data:
            first_name = update_data.get('first_name', doctor.get('first_name', ''))
            last_name = update_data.get('last_name', doctor.get('last_name', ''))
            update_data['name'] = f"{first_name} {last_name}".strip()
        
        # Add update timestamp
        update_data['updated_at'] = datetime.utcnow()
        
        # Update the doctor profile
        result = db[Doctor.collection_name].update_one(
            {'_id': ObjectId(current_user['id'])},
            {'$set': update_data}
        )
        
        if result.modified_count > 0:
            # Get updated doctor data
            updated_doctor = Doctor.find_by_id(db, current_user['id'])
            
            # Remove sensitive information
            if 'password' in updated_doctor:
                del updated_doctor['password']
            if 'otp' in updated_doctor:
                del updated_doctor['otp']
            
            return jsonify(updated_doctor), 200
        else:
            return jsonify({'message': 'No changes were made to the profile'}), 200
        
    except Exception as e:
        logger.error(f"Update doctor profile error: {str(e)}")
        return jsonify({'error': 'Profile update failed. Please try again.'}), 500

@doctor_bp.route('/profile', methods=['DELETE'])
def delete_doctor_profile():
    """Delete doctor profile"""
    try:
        data = request.get_json()
        logger.info(f"Doctor profile deletion request received for email: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Check if doctor exists
        doctor = Doctor.find_by_email(db, data['email'])
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        # Delete doctor
        success = Doctor.delete(db, doctor['id'])
        
        if not success:
            return jsonify({'message': 'Failed to delete doctor'}), 400
        
        return jsonify({
            'message': 'Doctor profile deleted successfully',
            'user_id': doctor['id']
        }), 200
        
    except Exception as e:
        logger.error(f"Doctor profile deletion error: {str(e)}")
        return jsonify({'error': 'Deletion failed. Please try again.'}), 500

@doctor_bp.route('/file-upload', methods=['POST'])
def upload_file():
    """Upload a file for doctor"""
    try:
        data = request.get_json()
        logger.info(f"Doctor file upload request received for email: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['email', 'file']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Check if doctor exists
        doctor = Doctor.find_by_email(db, data['email'])
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        # Validate file
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        if file.size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size exceeds limit'}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Create notification for admin
        Notification.create(db, {
            'title': 'New File Upload',
            'message': f"Doctor {doctor['name']} has uploaded a new file",
            'type': 'info',
            'userId': 'admin',
            'relatedTo': {
                'type': 'doctor',
                'id': doctor['id']
            }
        })
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file_path': file_path
        }), 200
        
    except Exception as e:
        logger.error(f"Doctor file upload error: {str(e)}")
        return jsonify({'error': 'Upload failed. Please try again.'}), 500

# Doctor Appointment Management Routes
@doctor_bp.route('/appointments/pending', methods=['GET'])
@doctor_required
def get_pending_appointments(current_user):
    """Get pending appointment requests for the current doctor"""
    try:
        db = get_db()
        
        # Get pending appointments for this doctor
        appointments = Appointment.find_pending_by_doctor_id(db, current_user['id'])
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get pending appointments error: {str(e)}")
        return jsonify({'error': 'Failed to fetch pending appointments'}), 500

@doctor_bp.route('/appointments/today', methods=['GET'])
@doctor_required
def get_today_appointments(current_user):
    """Get today's appointments for the current doctor"""
    try:
        db = get_db()
        
        # Get today's appointments for this doctor
        appointments = Appointment.find_today_by_doctor_id(db, current_user['id'])
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get today appointments error: {str(e)}")
        return jsonify({'error': 'Failed to fetch today appointments'}), 500

# Doctor Patient Management Routes
@doctor_bp.route('/patients', methods=['GET'])
@doctor_required
def get_doctor_patients(current_user):
    """Get all patients for the current doctor"""
    try:
        db = get_db()
        
        # Get patients who have had appointments with this doctor
        patients = Appointment.get_doctor_patients(db, current_user['id'])
        
        return jsonify({
            'patients': patients,
            'count': len(patients)
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor patients error: {str(e)}")
        return jsonify({'error': 'Failed to fetch patients'}), 500

@doctor_bp.route('/patients/<patient_id>', methods=['GET'])
@doctor_required
def get_patient_details(current_user, patient_id):
    """Get detailed information about a specific patient"""
    try:
        db = get_db()
        
        # Get patient details
        patient = Patient.find_by_id(db, patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Get appointment history between this doctor and patient
        appointments = Appointment.find_by_patient_id(db, patient_id)
        doctor_appointments = [apt for apt in appointments if apt.get('doctor_id') == current_user['id']]
        
        # Add appointment history to patient data
        patient['appointments'] = doctor_appointments
        
        return jsonify(patient), 200
        
    except Exception as e:
        logger.error(f"Get patient details error: {str(e)}")
        return jsonify({'error': 'Failed to fetch patient details'}), 500

# Doctor Statistics Routes
@doctor_bp.route('/stats/total-patients', methods=['GET'])
@doctor_required
def get_total_patients_count(current_user):
    """Get total number of unique patients for the current doctor"""
    try:
        db = get_db()
        
        # Get total patients count for this doctor
        total_patients = Appointment.get_doctor_patients_count(db, current_user['id'])
        
        return jsonify({
            'totalPatients': total_patients,
            'doctorId': current_user['id']
        }), 200
        
    except Exception as e:
        logger.error(f"Get total patients count error: {str(e)}")
        return jsonify({'error': 'Failed to fetch patient statistics'}), 500

# Doctor Availability Management Routes
@doctor_bp.route('/availability', methods=['GET'])
@doctor_required
def get_doctor_availability(current_user):
    """Get doctor's weekly availability schedule"""
    try:
        db = get_db()
        
        # Get availability for this doctor
        availability = DoctorAvailability.find_by_doctor_id(db, current_user['id'])
        
        return jsonify({
            'availability': availability,
            'doctorId': current_user['id']
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor availability error: {str(e)}")
        return jsonify({'error': 'Failed to fetch availability schedule'}), 500

@doctor_bp.route('/availability', methods=['PUT'])
@doctor_required
def update_doctor_availability(current_user):
    """Update doctor's weekly availability schedule"""
    try:
        data = request.get_json()
        
        if not data or 'weekly_availability' not in data:
            return jsonify({'error': 'Weekly availability data is required'}), 400
        
        db = get_db()
        
        # Update availability for this doctor
        availability = DoctorAvailability.create_or_update(
            db, 
            current_user['id'], 
            data['weekly_availability']
        )
        
        if not availability:
            return jsonify({'error': 'Failed to update availability'}), 500
        
        return jsonify({
            'message': 'Availability updated successfully',
            'availability': availability
        }), 200
        
    except Exception as e:
        logger.error(f"Update doctor availability error: {str(e)}")
        return jsonify({'error': 'Failed to update availability schedule'}), 500

@doctor_bp.route('/availability/day/<day_of_week>', methods=['GET'])
@doctor_required
def get_doctor_availability_for_day(current_user, day_of_week):
    """Get doctor's availability for a specific day of the week"""
    try:
        db = get_db()
        
        # Validate day of week
        valid_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        if day_of_week.lower() not in valid_days:
            return jsonify({'error': 'Invalid day of week'}), 400
        
        # Get available slots for the specified day
        available_slots = DoctorAvailability.get_available_slots_for_day(
            db, 
            current_user['id'], 
            day_of_week.lower()
        )
        
        return jsonify({
            'day': day_of_week.lower(),
            'available_slots': available_slots,
            'doctorId': current_user['id']
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor availability for day error: {str(e)}")
        return jsonify({'error': 'Failed to fetch availability for the specified day'}), 500

# Appointment Action Routes
@api_bp.route('/appointments/<appointment_id>/accept', methods=['POST'])
@token_required
def accept_appointment(current_user, appointment_id):
    """Accept an appointment request"""
    try:
        db = get_db()
        
        # Verify user is a doctor
        if current_user.get('role') != 'doctor':
            return jsonify({'message': 'Doctor access required'}), 403
        
        # Get appointment details
        appointment = Appointment.find_by_id(db, appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
            
        # Check if this appointment belongs to the doctor
        if appointment.get('doctor_id') != current_user.get('id'):
            return jsonify({'error': 'Unauthorized access to this appointment'}), 403
        
        # Update appointment status to confirmed
        success = Appointment.update_status(db, appointment_id, 'confirmed')
        
        if not success:
            return jsonify({'error': 'Appointment not found or already updated'}), 404
        
        # Check if this is an immediate appointment
        is_immediate = appointment.get('is_immediate', False)
        
        # Get payment information for this appointment
        payment = Payment.find_by_appointment_id(db, appointment_id)
        
        # Create notification for patient
        try:
            notification_message = f"Dr. {appointment.get('doctor_name')} has confirmed your appointment"
            if is_immediate:
                notification_message += " - Join now for your consultation"
                
            Notification.create(db, {
                'title': 'Appointment Confirmed' + (' - Ready to Join' if is_immediate else ''),
                'message': notification_message,
                'type': 'appointment',
                'userId': appointment.get('patient_id'),
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment_id
                }
            })
        except Exception as notif_error:
            logger.error(f"Error creating patient notification: {notif_error}")
        
        # For immediate appointments, return information needed to join the consultation
        if is_immediate:
            # Generate consultation data for immediate joining
            consultation_data = {
                'appointment_id': appointment_id,
                'video_call_id': appointment.get('video_call_id', f"call_{appointment_id}"),
                'consultation_type': appointment.get('consultation_type', 'video'),
                'patient_name': appointment.get('patient_name'),
                'doctor_name': appointment.get('doctor_name'),
                'appointment_date': appointment.get('appointment_date'),
                'call_url': f"/video-call/{appointment.get('video_call_id', appointment_id)}",
                'chat_url': f"/chat/{appointment_id}",
                'is_immediate': True,
                'ready_to_join': True
            }
            
            return jsonify({
                'message': 'Immediate appointment accepted - Ready for consultation',
                'appointment_id': appointment_id,
                'consultation': consultation_data,
                'payment_status': payment.get('payment_status') if payment else 'unknown'
            }), 200
        else:
            return jsonify({
            'message': 'Appointment accepted successfully',
                'appointment_id': appointment_id,
                'payment_status': payment.get('payment_status') if payment else 'unknown'
        }), 200
        
    except Exception as e:
        logger.error(f"Accept appointment error: {str(e)}")
        return jsonify({'error': 'Failed to accept appointment'}), 500

@api_bp.route('/appointments/<appointment_id>/decline', methods=['POST'])
@token_required
def decline_appointment(current_user, appointment_id):
    """Decline an appointment request"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Not specified')
            
        db = get_db()
        
        # Verify user is a doctor
        if current_user.get('role') != 'doctor':
            return jsonify({'message': 'Doctor access required'}), 403
        
        # Get appointment details
        appointment = Appointment.find_by_id(db, appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
            
        # Check if this appointment belongs to the doctor
        if appointment.get('doctor_id') != current_user.get('id'):
            return jsonify({'error': 'Unauthorized access to this appointment'}), 403
        
        # Check if this is an immediate appointment
        is_immediate = appointment.get('is_immediate', False)
        
        # Update appointment status to declined
        success = Appointment.update_status(db, appointment_id, 'declined', rejection_reason=reason)
        
        if not success:
            return jsonify({'error': 'Appointment not found or already updated'}), 404
            
        # For immediate appointments, automatically refund the payment
        payment = None
        if is_immediate:
            try:
                # Find payment for this appointment
                payment = Payment.find_by_appointment_id(db, appointment_id)
                
                if payment:
                    # Process refund
                    Payment.update_status(db, payment.get('id'), 'refunded', 'auto_refund_immediate_decline')
                    
                    # Log the refund transaction
                    db.refunds.insert_one({
                        'payment_id': payment.get('id'),
                        'appointment_id': appointment_id,
                        'amount': payment.get('amount'),
                        'reason': 'Doctor declined immediate appointment',
                        'processed_by': 'system',
                        'processed_at': datetime.utcnow().isoformat(),
                        'status': 'completed'
                    })
                    
                    logger.info(f"Auto-refunded payment {payment.get('id')} for declined immediate appointment {appointment_id}")
            except Exception as e:
                logger.error(f"Error processing auto-refund: {str(e)}")
            
        # Create notification for patient
        try:
            notification_message = f"Dr. {appointment.get('doctor_name')} has declined your appointment request"
            if reason:
                notification_message += f"\nReason: {reason}"
            if is_immediate and payment:
                notification_message += "\nYour payment has been automatically refunded."
                
            Notification.create(db, {
                'title': 'Appointment Declined',
                'message': notification_message,
                'type': 'appointment',
                'userId': appointment.get('patient_id'),
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment_id
                }
            })
        except Exception as notif_error:
            logger.error(f"Error creating patient notification: {notif_error}")
        
        # Create notification for admin
        try:
            admin_message = f"Dr. {appointment.get('doctor_name')} has declined appointment with {appointment.get('patient_name')}"
            if reason:
                admin_message += f"\nReason: {reason}"
            if is_immediate and payment:
                admin_message += "\nPayment has been automatically refunded."
                
            Notification.create(db, {
                'title': 'Appointment Declined',
                'message': admin_message,
                'type': 'appointment',
                'userId': 'admin',
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment_id
                }
            })
        except Exception as notif_error:
            logger.error(f"Error creating admin notification: {notif_error}")
        
        # Return response with payment status
        response_data = {
            'message': 'Appointment declined successfully',
            'appointment_id': appointment_id
        }
        
        # Add payment info if this was an immediate appointment
        if is_immediate:
            response_data['payment_refunded'] = bool(payment)
            if payment:
                response_data['payment_id'] = payment.get('id')
                response_data['refund_status'] = 'processed'
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Decline appointment error: {str(e)}")
        return jsonify({'error': 'Failed to decline appointment'}), 500

# Health check endpoint for API testing
@api_bp.route('/health-check', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        db = get_db()
        # Test database connection
        db.list_collection_names()
        return jsonify({
            'status': 'healthy',
            'message': 'Backend API is running',
            'database': 'connected',
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'message': 'Backend API has issues',
            'database': 'disconnected',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

# File serving endpoint
@api_bp.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    """Serve uploaded files"""
    try:
        # Security check - ensure file is within upload directory
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Invalid file path'}), 400
        
        # Handle both direct paths and paths that include "uploads/" prefix
        if filename.startswith('uploads/') or filename.startswith('uploads\\'):
            # Remove the uploads prefix since we're already adding it
            filename = filename[8:]  # Remove "uploads/" or "uploads\"
        
        # Convert Windows backslashes to forward slashes
        filename = filename.replace('\\', '/')
        
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({'error': f'File not found: {filename}'}), 404
        
        # Send file
        return send_file(file_path)
        
    except Exception as e:
        logger.error(f"File serving error: {str(e)}")
        return jsonify({'error': 'Failed to serve file'}), 500

# Patient-specific routes
patient_bp = Blueprint('patient', __name__)

def patient_required(f):
    """Decorator to ensure patient authentication"""
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'patient':
            return jsonify({'message': 'Patient access required'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@patient_bp.route('/profile', methods=['GET'])
@patient_required
def get_patient_profile(current_user):
    """Get current patient's profile"""
    try:
        db = get_db()
        patient = Patient.find_by_id(db, current_user['id'])
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Remove sensitive information
        if 'password' in patient:
            del patient['password']
        if 'otp' in patient:
            del patient['otp']
            
        return jsonify(patient), 200
        
    except Exception as e:
        logger.error(f"Get patient profile error: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500

@patient_bp.route('/appointments', methods=['GET'])
@patient_required
def get_patient_appointments(current_user):
    """Get all appointments for the current patient"""
    try:
        db = get_db()
        
        # Get appointments for this patient
        appointments = Appointment.find_by_patient_id(db, current_user['id'])
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient appointments error: {str(e)}")
        return jsonify({'error': 'Failed to fetch appointments'}), 500

@patient_bp.route('/appointments/upcoming', methods=['GET'])
@patient_required
def get_upcoming_appointments(current_user):
    """Get upcoming appointments for the current patient"""
    try:
        db = get_db()
        
        # Get upcoming appointments for this patient
        appointments = list(db[Appointment.collection_name].find({
            'patient_id': current_user['id'],
            'status': {'$in': ['pending', 'confirmed']}
        }).sort('appointment_date', 1))
        
        appointments = Appointment.serialize_list(appointments)
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get upcoming appointments error: {str(e)}")
        return jsonify({'error': 'Failed to fetch upcoming appointments'}), 500

@patient_bp.route('/appointments/completed', methods=['GET'])
@patient_required
def get_completed_appointments(current_user):
    """Get completed appointments for the current patient"""
    try:
        db = get_db()
        
        # Get completed appointments for this patient
        appointments = list(db[Appointment.collection_name].find({
            'patient_id': current_user['id'],
            'status': 'completed'
        }).sort('appointment_date', -1))
        
        appointments = Appointment.serialize_list(appointments)
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get completed appointments error: {str(e)}")
        return jsonify({'error': 'Failed to fetch completed appointments'}), 500

@patient_bp.route('/stats', methods=['GET'])
@patient_required
def get_patient_stats(current_user):
    """Get patient statistics"""
    try:
        db = get_db()
        
        # Get all appointments for this patient
        appointments = Appointment.find_by_patient_id(db, current_user['id'])
        
        # Calculate stats
        upcoming = len([apt for apt in appointments if apt['status'] in ['pending', 'confirmed']])
        completed = len([apt for apt in appointments if apt['status'] == 'completed'])
        total = len(appointments)
        
        # Get patient profile for completion calculation
        patient = Patient.find_by_id(db, current_user['id'])
        profile_completion = 0
        
        if patient:
            fields = ['name', 'email', 'phone', 'gender', 'dateOfBirth']
            filled_fields = [field for field in fields if patient.get(field)]
            profile_completion = (len(filled_fields) / len(fields)) * 100
        
        return jsonify({
            'upcomingAppointments': upcoming,
            'completedAppointments': completed,
            'totalAppointments': total,
            'profileCompletion': round(profile_completion, 1)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient stats error: {str(e)}")
        return jsonify({'error': 'Failed to fetch patient statistics'}), 500

@patient_bp.route('/profile', methods=['PUT'])
@patient_required
def update_patient_profile(current_user):
    """Update patient profile with optional photo upload"""
    try:
        # Create upload folder if it doesn't exist
        create_upload_folder()
        
        db = get_db()
        
        # Get current patient data
        patient = Patient.find_by_id(db, current_user['id'])
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        update_data = {}
        
        # Handle form data (for multipart/form-data requests)
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Get form fields
            if request.form.get('name'):
                update_data['name'] = request.form.get('name')
            if request.form.get('phone'):
                update_data['phone'] = request.form.get('phone')
            if request.form.get('gender'):
                update_data['gender'] = request.form.get('gender')
            if request.form.get('dateOfBirth'):
                update_data['dateOfBirth'] = request.form.get('dateOfBirth')
            
            # Handle profile picture upload
            if 'profile_picture' in request.files:
                file = request.files['profile_picture']
                if file and file.filename and allowed_file(file.filename):
                    # Validate file size (5MB max)
                    if file.content_length and file.content_length > 5 * 1024 * 1024:
                        return jsonify({'error': 'File size exceeds 5MB limit'}), 400
                    
                    filename = secure_filename(f"patient_profile_{current_user['id']}_{file.filename}")
                    file_path = os.path.join(UPLOAD_FOLDER, 'profile_pictures', filename)
                    
                    # Create profile pictures subfolder if it doesn't exist
                    profile_pics_folder = os.path.join(UPLOAD_FOLDER, 'profile_pictures')
                    if not os.path.exists(profile_pics_folder):
                        os.makedirs(profile_pics_folder)
                    
                    file.save(file_path)
                    update_data['profile_picture'] = f"/api/uploads/profile_pictures/{filename}"
                elif file and file.filename:
                    return jsonify({'error': 'Profile picture file type not allowed'}), 400
        
        # Handle JSON data (for application/json requests)
        else:
            data = request.get_json()
            if data:
                for field in ['name', 'phone', 'gender', 'dateOfBirth']:
                    if field in data and data[field] is not None:
                        update_data[field] = data[field]
        
        # Add update timestamp
        update_data['updated_at'] = datetime.utcnow()
        
        # Update the patient profile
        result = db[Patient.collection_name].update_one(
            {'_id': ObjectId(current_user['id'])},
            {'$set': update_data}
        )
        
        if result.modified_count > 0:
            # Get updated patient data
            updated_patient = Patient.find_by_id(db, current_user['id'])
            
            # Remove sensitive information
            if 'password' in updated_patient:
                del updated_patient['password']
            if 'otp' in updated_patient:
                del updated_patient['otp']
            
            return jsonify(updated_patient), 200
        else:
            return jsonify({'message': 'No changes were made to the profile'}), 200
        
    except Exception as e:
        logger.error(f"Update patient profile error: {str(e)}")
        return jsonify({'error': 'Profile update failed. Please try again.'}), 500

# Public Appointment Creation Route
@api_bp.route('/appointments', methods=['POST'])
@token_required
def create_appointment(current_user):
    """Create a new appointment request with slot validation"""
    try:
        data = request.get_json()
        logger.info(f"Create appointment request - User: {current_user.get('id')}, Data: {data}")
        
        # Validate required fields
        required_fields = ['doctor_id', 'appointment_date', 'reason']
        for field in required_fields:
            if not data.get(field):
                logger.error(f"Missing required field: {field}")
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        logger.info(f"Database connection established")
        
        # Verify doctor exists and is approved
        try:
            doctor = Doctor.find_by_id(db, data['doctor_id'])
            logger.info(f"Doctor lookup result: {doctor is not None}")
        except Exception as e:
            logger.error(f"Error finding doctor: {e}")
            return jsonify({'error': 'Failed to verify doctor'}), 500
            
        if not doctor or doctor.get('verificationStatus') != 'approved':
            logger.error(f"Doctor not found or not approved. Doctor: {doctor}")
            return jsonify({'error': 'Doctor not found or not available'}), 404
        
        # Validate appointment slot availability
        appointment_datetime = data['appointment_date']
        
        # Log the validation process for debugging
        logger.info(f"Validating appointment slot for doctor {data['doctor_id']} at {appointment_datetime}")
        
        # Check if the requested slot is available
        try:
            is_slot_available, availability_message = DoctorAvailability.book_slot(
                db, 
                data['doctor_id'], 
                appointment_datetime, 
                None  # No appointment ID yet since we're just checking
            )
            logger.info(f"Slot availability check completed: {is_slot_available}, message: {availability_message}")
        except Exception as e:
            logger.error(f"Error checking slot availability: {e}")
            return jsonify({'error': 'Failed to validate appointment slot'}), 500
        
        # Check if slot is already booked
        try:
            is_slot_booked = DoctorAvailability.is_slot_booked(db, data['doctor_id'], appointment_datetime)
            logger.info(f"Slot booking check completed: {is_slot_booked}")
        except Exception as e:
            logger.error(f"Error checking if slot is booked: {e}")
            return jsonify({'error': 'Failed to check slot booking status'}), 500
        
        if not is_slot_available:
            return jsonify({
                'error': 'Selected time slot is not available',
                'message': availability_message,
                'suggestion': 'Please choose a different time slot within doctor\'s availability hours',
                'validation_details': {
                    'within_availability': is_slot_available,
                    'slot_booked': is_slot_booked,
                    'datetime_checked': appointment_datetime
                }
            }), 400
        
        if is_slot_booked:
            # Get details about conflicting appointments for better error message
            try:
                slot_dt = datetime.fromisoformat(appointment_datetime.replace('Z', '').replace('T', ' ').split('.')[0])
                date_only = slot_dt.date().isoformat()
                
                conflicting_appointments = list(db[Appointment.collection_name].find({
                    'doctor_id': data['doctor_id'],
                    'status': {'$in': ['confirmed', 'pending']},
                    'appointment_date': {'$regex': f'^{date_only}'}
                }))
                
                logger.info(f"Found {len(conflicting_appointments)} conflicting appointments for doctor {data['doctor_id']} on {date_only}")
                for apt in conflicting_appointments:
                    logger.info(f"  - Appointment {apt.get('_id')}: {apt.get('appointment_date')} (status: {apt.get('status')})")
                
            except Exception as e:
                logger.error(f"Error getting conflicting appointment details: {e}")
                conflicting_appointments = []
            
            return jsonify({
                'error': 'Selected time slot is already booked',
                'message': 'Another patient has already booked this time slot',
                'suggestion': 'Please refresh the page and choose a different time slot',
                'validation_details': {
                    'within_availability': is_slot_available,
                    'slot_booked': is_slot_booked,
                    'datetime_checked': appointment_datetime,
                    'conflicting_appointments_count': len(conflicting_appointments)
                }
            }), 409  # Conflict status code
        
        # Check if this is an immediate appointment (within 2 hours)
        try:
            slot_dt = datetime.fromisoformat(appointment_datetime.replace('Z', '').replace('T', ' ').split('.')[0])
            current_dt = datetime.utcnow()
            time_diff = (slot_dt - current_dt).total_seconds() / 3600  # difference in hours
            is_immediate = time_diff <= 2
            logger.info(f"Appointment time difference: {time_diff} hours, is_immediate: {is_immediate}")
        except Exception as e:
            logger.error(f"Error calculating time difference: {e}")
            is_immediate = False
        
        # Create appointment data with enhanced fields
        appointment_data = {
            'patient_id': current_user['id'],
            'patient_name': data.get('patient_name', current_user.get('email', 'Unknown')),
            'patient_phone': data.get('patient_phone', ''),
            'patient_email': data.get('patient_email', current_user.get('email', '')),
            'doctor_id': data['doctor_id'],
            'doctor_name': data.get('doctor_name', doctor.get('name', 'Unknown')),
            'appointment_date': data['appointment_date'],
            'status': 'pending',
            'reason': data['reason'],
            'notes': data.get('notes', ''),
            'consultation_type': data.get('consultation_type', 'video'),  # video, chat, phone
            'urgent': data.get('urgent', False),
            'preferred_language': data.get('preferred_language', 'English'),
            'medical_history': data.get('medical_history', ''),
            'report_complaint': data.get('report_complaint', ''),
            'video_call_id': data.get('video_call_id', f"call_{int(datetime.utcnow().timestamp())}"),
            'is_immediate': is_immediate  # Flag for immediate appointments
        }
        
        logger.info(f"Creating appointment with data: {appointment_data}")
        
        # Create the appointment
        try:
            appointment = Appointment.create(db, appointment_data)
            logger.info(f"Appointment created successfully with ID: {appointment.get('id')}")
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            return jsonify({'error': 'Failed to create appointment'}), 500
        
        # Double-check that the slot is still available (race condition protection)
        final_slot_check = DoctorAvailability.is_slot_booked(db, data['doctor_id'], appointment_datetime)
        if final_slot_check:
            # Another appointment was created in the meantime, delete this one
            try:
                db.appointments.delete_one({'_id': ObjectId(appointment['id'])})
            except Exception as delete_error:
                logger.error(f"Error deleting conflicted appointment: {delete_error}")
            return jsonify({
                'error': 'Time slot was booked by another patient while processing your request',
                'message': 'Please refresh the page and choose a different time slot',
                'suggestion': 'Try booking again with a different time'
            }), 409
        
        # Create notification for the doctor
        try:
            notification_message = f"Patient {appointment_data['patient_name']} has requested an appointment"
            if appointment_data['urgent']:
                notification_message += " (URGENT)"
            if appointment_data['is_immediate']:
                notification_message += " - IMMEDIATE APPOINTMENT"
                
            Notification.create(db, {
                'title': 'New Appointment Request' + (' (IMMEDIATE)' if appointment_data['is_immediate'] else ''),
                'message': notification_message,
                'type': 'appointment',
                'userId': data['doctor_id'],
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment['id']
                }
            })
        except Exception as notif_error:
            logger.error(f"Error creating doctor notification: {notif_error}")
        
        # Create notification for admin
        try:
            admin_message = f"New appointment request between {appointment_data['patient_name']} and Dr. {appointment_data['doctor_name']}"
            if appointment_data['urgent']:
                admin_message += " (URGENT)"
            if appointment_data['is_immediate']:
                admin_message += " (IMMEDIATE)"
                
            Notification.create(db, {
                'title': 'New Appointment Request',
                'message': admin_message,
                'type': 'appointment',
                'userId': 'admin',
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment['id']
                }
            })
        except Exception as notif_error:
            logger.error(f"Error creating admin notification: {notif_error}")
        
        return jsonify({
            'message': 'Appointment request created successfully',
            'appointment': appointment,
            'is_immediate': is_immediate,
            'slot_status': {
                'is_booked': True,
                'booked_by': 'current_request',
                'booking_time': datetime.utcnow().isoformat()
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Create appointment error: {str(e)}")
        return jsonify({'error': 'Failed to create appointment request'}), 500

# Test appointment creation endpoint for debugging
@api_bp.route('/appointments/test', methods=['POST'])
@token_required
def test_create_appointment(current_user):
    """Simplified test endpoint for appointment creation debugging"""
    try:
        data = request.get_json()
        logger.info(f"Test appointment creation - User: {current_user.get('id')}")
        logger.info(f"Test appointment data: {data}")
        
        # Basic validation
        if not data.get('doctor_id'):
            return jsonify({'error': 'doctor_id is required'}), 400
        
        if not data.get('appointment_date'):
            return jsonify({'error': 'appointment_date is required'}), 400
            
        if not data.get('reason'):
            return jsonify({'error': 'reason is required'}), 400
        
        # Test database connection
        try:
            db = get_db()
            logger.info("Database connection test passed")
        except Exception as db_error:
            logger.error(f"Database connection failed: {db_error}")
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Test doctor lookup
        try:
            doctor = Doctor.find_by_id(db, data['doctor_id'])
            logger.info(f"Doctor lookup test passed: {doctor is not None}")
            if not doctor:
                return jsonify({'error': 'Doctor not found'}), 404
        except Exception as doctor_error:
            logger.error(f"Doctor lookup failed: {doctor_error}")
            return jsonify({'error': 'Doctor lookup failed'}), 500
        
        # Test appointment data creation
        try:
            appointment_data = {
                'patient_id': current_user['id'],
                'patient_name': data.get('patient_name', current_user.get('email', 'Unknown')),
                'patient_phone': data.get('patient_phone', ''),
                'patient_email': data.get('patient_email', current_user.get('email', '')),
                'doctor_id': data['doctor_id'],
                'doctor_name': data.get('doctor_name', doctor.get('name', 'Unknown')),
                'appointment_date': data['appointment_date'],
                'status': 'pending',
                'reason': data['reason'],
                'notes': data.get('notes', ''),
                'consultation_type': data.get('consultation_type', 'video'),
                'urgent': data.get('urgent', False),
                'preferred_language': data.get('preferred_language', 'English'),
                'medical_history': data.get('medical_history', ''),
                'report_complaint': data.get('report_complaint', ''),
                'video_call_id': f"call_{int(datetime.utcnow().timestamp())}"
            }
            logger.info(f"Appointment data creation test passed")
        except Exception as data_error:
            logger.error(f"Appointment data creation failed: {data_error}")
            return jsonify({'error': 'Failed to prepare appointment data'}), 500
        
        # Test appointment model creation
        try:
            appointment = Appointment.create(db, appointment_data)
            logger.info(f"Appointment model creation test passed: {appointment.get('id')}")
        except Exception as create_error:
            logger.error(f"Appointment model creation failed: {create_error}")
            return jsonify({'error': 'Failed to create appointment in database'}), 500
        
        return jsonify({
            'message': 'Test appointment created successfully',
            'appointment': appointment,
            'test_results': {
                'database_connection': 'passed',
                'doctor_lookup': 'passed',
                'data_preparation': 'passed',
                'appointment_creation': 'passed'
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Test create appointment error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Test failed: {str(e)}'}), 500

# Payment Routes

@payment_bp.route('/process', methods=['POST'])
@token_required
def process_payment(current_user):
    """Process payment for appointment"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['appointment_id', 'amount', 'payment_method']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Get appointment details
        appointment = Appointment.find_by_id(db, data['appointment_id'])
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        # Get doctor details
        doctor = Doctor.find_by_id(db, appointment['doctor_id'])
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        # Check if payment already exists for this appointment
        existing_payment = Payment.find_by_appointment_id(db, data['appointment_id'])
        if existing_payment:
            return jsonify({'error': 'Payment already exists for this appointment'}), 400
        
        # Generate transaction ID
        transaction_id = Payment.generate_transaction_id()
        
        # Create payment record
        payment_data = {
            'appointment_id': data['appointment_id'],
            'patient_id': current_user['id'],
            'patient_name': appointment.get('patient_name', current_user.get('email')),
            'doctor_id': appointment['doctor_id'],
            'doctor_name': appointment.get('doctor_name', doctor.get('name')),
            'amount': float(data['amount']),
            'currency': data.get('currency', 'INR'),
            'payment_method': data['payment_method'],  # credit, debit, upi
            'payment_type': 'consultation',
            'status': 'processing',
            'payment_status': 'hold',
            'transaction_id': transaction_id,
            'payment_gateway': 'dummy',
            'payment_data': data.get('payment_data', {})
        }
        
        payment = Payment.create(db, payment_data)
        
        # Simulate payment processing (replace with real payment gateway)
        import time
        time.sleep(1)  # Simulate processing time
        
        # For demo purposes, assume payment is successful
        success = True  # In real implementation, check with payment gateway
        
        if success:
            # Update payment status to completed
            Payment.update_status(db, payment['id'], 'completed', transaction_id)
            
            # Update appointment status to confirmed (payment received)
            Appointment.update_status(db, data['appointment_id'], 'confirmed')
            
            # Create notification for doctor
            Notification.create(db, {
                'title': 'Payment Received',
                'message': f"Payment of ₹{data['amount']} received for appointment with {appointment.get('patient_name')}",
                'type': 'payment',
                'userId': appointment['doctor_id'],
                'relatedTo': {
                    'type': 'payment',
                    'id': payment['id']
                }
            })
            
            # Create notification for admin
            Notification.create(db, {
                'title': 'New Payment',
                'message': f"Payment of ₹{data['amount']} received. Appointment between {appointment.get('patient_name')} and Dr. {appointment.get('doctor_name')}",
                'type': 'payment',
                'userId': 'admin',
                'relatedTo': {
                    'type': 'payment',
                    'id': payment['id']
                }
            })
            
            return jsonify({
                'message': 'Payment processed successfully',
                'payment': payment,
                'transaction_id': transaction_id,
                'status': 'completed'
            }), 200
        else:
            # Update payment status to failed
            Payment.update_status(db, payment['id'], 'failed')
            return jsonify({'error': 'Payment processing failed'}), 400
        
    except Exception as e:
        logger.error(f"Process payment error: {str(e)}")
        return jsonify({'error': 'Payment processing failed'}), 500

@payment_bp.route('/status/<appointment_id>', methods=['GET'])
@token_required
def get_payment_status(current_user, appointment_id):
    """Get payment status for an appointment"""
    try:
        db = get_db()
        
        payment = Payment.find_by_appointment_id(db, appointment_id)
        if not payment:
            return jsonify({'error': 'Payment not found'}), 404
        
        # Check if user has permission to view this payment
        if (current_user['role'] == 'patient' and payment['patient_id'] != current_user['id'] or
            current_user['role'] == 'doctor' and payment['doctor_id'] != current_user['id']):
            if current_user['role'] != 'admin':
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(payment), 200
        
    except Exception as e:
        logger.error(f"Get payment status error: {str(e)}")
        return jsonify({'error': 'Failed to get payment status'}), 500

@payment_bp.route('/patient/<patient_id>', methods=['GET'])
@token_required
def get_patient_payments(current_user, patient_id):
    """Get all payments for a patient"""
    try:
        # Check permissions
        if current_user['role'] == 'patient' and current_user['id'] != patient_id:
            return jsonify({'error': 'Access denied'}), 403
        
        if current_user['role'] not in ['patient', 'admin']:
            return jsonify({'error': 'Access denied'}), 403
        
        db = get_db()
        payments = Payment.find_by_patient_id(db, patient_id)
        
        return jsonify({'payments': payments}), 200
        
    except Exception as e:
        logger.error(f"Get patient payments error: {str(e)}")
        return jsonify({'error': 'Failed to get patient payments'}), 500

@payment_bp.route('/doctor/<doctor_id>', methods=['GET'])
@token_required
def get_doctor_payments(current_user, doctor_id):
    """Get all payments for a doctor"""
    try:
        # Check permissions
        if current_user['role'] == 'doctor' and current_user['id'] != doctor_id:
            return jsonify({'error': 'Access denied'}), 403
        
        if current_user['role'] not in ['doctor', 'admin']:
            return jsonify({'error': 'Access denied'}), 403
        
        db = get_db()
        payments = Payment.find_by_doctor_id(db, doctor_id)
        
        return jsonify({'payments': payments}), 200
        
    except Exception as e:
        logger.error(f"Get doctor payments error: {str(e)}")
        return jsonify({'error': 'Failed to get doctor payments'}), 500

# Admin Payment Management Routes

@admin_bp.route('/payments', methods=['GET'])
@admin_required
def get_all_payments(current_user):
    """Get all payments for admin dashboard"""
    try:
        db = get_db()
        
        # Get query parameters for filtering
        status = request.args.get('status')
        payment_status = request.args.get('payment_status')
        
        filters = {}
        if status:
            filters['status'] = status
        if payment_status:
            filters['payment_status'] = payment_status
        
        payments = Payment.find_all(db, filters)
        
        return jsonify({'payments': payments}), 200
        
    except Exception as e:
        logger.error(f"Get all payments error: {str(e)}")
        return jsonify({'error': 'Failed to get payments'}), 500

@admin_bp.route('/payments/<payment_id>/approve', methods=['PUT'])
@admin_required
def approve_payment_release(current_user, payment_id):
    """Admin approves payment for release to doctor"""
    try:
        db = get_db()
        
        # Get payment details
        payment = Payment.find_by_id(db, payment_id)
        if not payment:
            return jsonify({'error': 'Payment not found'}), 404
        
        # Check if appointment is completed
        appointment = Appointment.find_by_id(db, payment['appointment_id'])
        if not appointment or appointment['status'] != 'completed':
            return jsonify({'error': 'Cannot approve payment for incomplete consultation'}), 400
        
        # Approve payment
        success = Payment.approve_payment(db, payment_id, current_user['id'], current_user.get('name', 'Admin'))
        
        if success:
            # Create notification for doctor
            Notification.create(db, {
                'title': 'Payment Approved',
                'message': f"Payment of ₹{payment['amount']} has been approved for release",
                'type': 'payment',
                'userId': payment['doctor_id'],
                'relatedTo': {
                    'type': 'payment',
                    'id': payment['id']
                }
            })
            
            return jsonify({'message': 'Payment approved successfully'}), 200
        else:
            return jsonify({'error': 'Failed to approve payment'}), 500
        
    except Exception as e:
        logger.error(f"Approve payment error: {str(e)}")
        return jsonify({'error': 'Failed to approve payment'}), 500

@admin_bp.route('/payments/<payment_id>/release', methods=['PUT'])
@admin_required
def release_payment_to_doctor(current_user, payment_id):
    """Admin releases approved payment to doctor"""
    try:
        db = get_db()
        
        # Get payment details
        payment = Payment.find_by_id(db, payment_id)
        if not payment:
            return jsonify({'error': 'Payment not found'}), 404
        
        # Check if payment is approved
        if not payment.get('admin_approved'):
            return jsonify({'error': 'Payment must be approved before release'}), 400
        
        # Release payment
        success = Payment.release_payment(db, payment_id)
        
        if success:
            # Create notification for doctor
            Notification.create(db, {
                'title': 'Payment Released',
                'message': f"Payment of ₹{payment['amount']} has been released to your account",
                'type': 'payment',
                'userId': payment['doctor_id'],
                'relatedTo': {
                    'type': 'payment',
                    'id': payment['id']
                }
            })
            
            return jsonify({'message': 'Payment released successfully'}), 200
        else:
            return jsonify({'error': 'Failed to release payment'}), 500
        
    except Exception as e:
        logger.error(f"Release payment error: {str(e)}")
        return jsonify({'error': 'Failed to release payment'}), 500

@admin_bp.route('/payments/<payment_id>/cancel', methods=['PUT'])
@admin_required
def cancel_payment(current_user, payment_id):
    """Admin cancels payment and initiates refund"""
    try:
        data = request.get_json()
        reason = data.get('reason', 'Cancelled by admin')
        
        db = get_db()
        
        # Get payment details
        payment = Payment.find_by_id(db, payment_id)
        if not payment:
            return jsonify({'error': 'Payment not found'}), 404
        
        # Cancel payment
        success = Payment.cancel_payment(db, payment_id, reason)
        
        if success:
            # Update appointment status to cancelled
            Appointment.update_status(db, payment['appointment_id'], 'cancelled')
            
            # Create notifications
            Notification.create(db, {
                'title': 'Payment Cancelled',
                'message': f"Payment of ₹{payment['amount']} has been cancelled and refund initiated",
                'type': 'payment',
                'userId': payment['patient_id'],
                'relatedTo': {
                    'type': 'payment',
                    'id': payment['id']
                }
            })
            
            Notification.create(db, {
                'title': 'Appointment Cancelled',
                'message': f"Appointment cancelled due to payment cancellation",
                'type': 'appointment',
                'userId': payment['doctor_id'],
                'relatedTo': {
                    'type': 'appointment',
                    'id': payment['appointment_id']
                }
            })
            
            return jsonify({'message': 'Payment cancelled successfully'}), 200
        else:
            return jsonify({'error': 'Failed to cancel payment'}), 500
        
    except Exception as e:
        logger.error(f"Cancel payment error: {str(e)}")
        return jsonify({'error': 'Failed to cancel payment'}), 500

@admin_bp.route('/payments/statistics', methods=['GET'])
@admin_required
def get_payment_statistics(current_user):
    """Get payment statistics for admin dashboard"""
    try:
        db = get_db()
        stats = Payment.get_payment_statistics(db)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Get payment statistics error: {str(e)}")
        return jsonify({'error': 'Failed to get payment statistics'}), 500

# Video Call Routes for Post-Payment Consultation

@api_bp.route('/consultations/join/<appointment_id>', methods=['GET'])
@token_required
def join_consultation(current_user, appointment_id):
    """Join consultation session after payment confirmation"""
    try:
        db = get_db()
        
        # Get appointment details
        appointment = Appointment.find_by_id(db, appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        # Check if user is part of this appointment
        if (current_user['role'] == 'patient' and str(appointment['patient_id']) != str(current_user['id']) or
            current_user['role'] == 'doctor' and str(appointment['doctor_id']) != str(current_user['id'])):
            return jsonify({'error': 'Access denied'}), 403
        
        # Check if appointment is confirmed (payment made)
        if appointment['status'] != 'confirmed':
            return jsonify({'error': 'Appointment not confirmed. Please complete payment first.'}), 400
        
        # Get payment details to ensure payment is completed
        payment = Payment.find_by_appointment_id(db, appointment_id)
        if not payment or payment['status'] != 'completed':
            return jsonify({'error': 'Payment not completed'}), 400
        
        # Generate or get video call details
        consultation_data = {
            'consultation_id': appointment_id,
            'appointment_id': appointment_id,
            'video_call_id': appointment.get('video_call_id', f"call_{appointment_id}"),
            'consultation_type': appointment.get('consultation_type', 'video'),
            'patient_name': appointment.get('patient_name'),
            'doctor_name': appointment.get('doctor_name'),
            'appointment_date': appointment.get('appointment_date'),
            'scheduled_time': appointment.get('appointment_date'),
            'call_url': f"/video-call/{appointment.get('video_call_id', appointment_id)}",
            'chat_url': f"/chat/{appointment_id}",
            'patient_id': str(appointment.get('patient_id')),
            'doctor_id': str(appointment.get('doctor_id')),
            'user_role': current_user['role'],
            'phone_number': appointment.get('patient_phone') if current_user['role'] == 'doctor' else None
        }
        
        # Return data directly, not nested under 'consultation'
        return jsonify(consultation_data), 200
        
    except Exception as e:
        logger.error(f"Join consultation error: {str(e)}")
        return jsonify({'error': 'Failed to join consultation'}), 500

@api_bp.route('/consultations/<appointment_id>/complete', methods=['PUT'])
@token_required
def complete_consultation(current_user, appointment_id):
    """Mark consultation as completed (only by doctor)"""
    try:
        if current_user['role'] != 'doctor':
            return jsonify({'error': 'Only doctors can mark consultations as completed'}), 403
        
        db = get_db()
        
        # Get appointment details
        appointment = Appointment.find_by_id(db, appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        # Check if doctor owns this appointment
        if appointment['doctor_id'] != current_user['id']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Update appointment status to completed
        success = Appointment.update_status(db, appointment_id, 'completed')
        
        if success:
            # Get payment for this appointment
            payment = Payment.find_by_appointment_id(db, appointment_id)
            
            # Create notification for patient
            Notification.create(db, {
                'title': 'Consultation Completed',
                'message': f"Your consultation with Dr. {appointment.get('doctor_name')} has been completed",
                'type': 'appointment',
                'userId': appointment['patient_id'],
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment_id
                }
            })
            
            if payment:
                # Auto-approve payment for release (since consultation is completed)
                Payment.approve_for_release(db, payment['id'])
                
                # Create notification for admin about auto-approved payment
                Notification.create(db, {
                    'title': 'Payment Auto-Approved',
                    'message': f"Payment of ₹{payment['amount']} auto-approved for release after consultation completion",
                    'type': 'payment',
                    'userId': 'admin',
                    'relatedTo': {
                        'type': 'payment',
                        'id': payment['id']
                    }
                })
                
                # Auto-release payment to doctor (immediate release after consultation completion)
                release_success = Payment.release_payment(db, payment['id'])
                
                if release_success:
                    # Create notification for doctor
                    Notification.create(db, {
                        'title': 'Payment Released',
                        'message': f"Payment of ₹{payment['amount']} has been automatically released to your account",
                        'type': 'payment',
                        'userId': appointment['doctor_id'],
                        'relatedTo': {
                            'type': 'payment',
                            'id': payment['id']
                        }
                    })
                    
                    # Create notification for patient
                    Notification.create(db, {
                        'title': 'Payment Processed',
                        'message': f"Payment of ₹{payment['amount']} has been released to Dr. {appointment.get('doctor_name')}",
                        'type': 'payment',
                        'userId': appointment['patient_id'],
                        'relatedTo': {
                            'type': 'payment',
                            'id': payment['id']
                        }
                    })
            
            return jsonify({
                'message': 'Consultation marked as completed',
                'payment_status': 'released' if payment and release_success else 'pending'
            }), 200
        else:
            return jsonify({'error': 'Failed to complete consultation'}), 500
        
    except Exception as e:
        logger.error(f"Complete consultation error: {str(e)}")
        return jsonify({'error': 'Failed to complete consultation'}), 500

# Add new endpoint for checking and auto-processing overdue consultations
@admin_bp.route('/payments/process-overdue', methods=['POST'])
@admin_required
def process_overdue_payments(current_user):
    """Process payments for overdue consultations (admin function)"""
    try:
        db = get_db()
        
        # Find appointments that are confirmed but past their scheduled time by more than 2 hours
        # and haven't been completed by the doctor
        cutoff_time = datetime.utcnow() - timedelta(hours=2)
        
        overdue_appointments = Appointment.find_overdue_appointments(db, cutoff_time)
        processed_payments = []
        
        for appointment in overdue_appointments:
            # Check if doctor joined the consultation
            doctor_joined = appointment.get('doctor_joined', False)
            
            if not doctor_joined:
                # Doctor didn't join, initiate refund
                payment = Payment.find_by_appointment_id(db, appointment['id'])
                if payment and payment['status'] == 'completed' and payment['payment_status'] == 'hold':
                    # Cancel payment and initiate refund
                    refund_success = Payment.cancel_payment(db, payment['id'], 'Doctor did not join consultation')
                    
                    if refund_success:
                        # Update appointment status
                        Appointment.update_status(db, appointment['id'], 'cancelled')
                        
                        # Notify patient
                        Notification.create(db, {
                            'title': 'Consultation Cancelled - Refund Initiated',
                            'message': f"Dr. {appointment.get('doctor_name')} did not join the consultation. Full refund of ₹{payment['amount']} has been initiated.",
                            'type': 'refund',
                            'userId': appointment['patient_id'],
                            'relatedTo': {
                                'type': 'payment',
                                'id': payment['id']
                            }
                        })
                        
                        # Notify doctor (penalty)
                        Notification.create(db, {
                            'title': 'Missed Consultation - Payment Refunded',
                            'message': f"You missed the consultation with {appointment.get('patient_name')}. Payment has been refunded to the patient.",
                            'type': 'warning',
                            'userId': appointment['doctor_id'],
                            'relatedTo': {
                                'type': 'appointment',
                                'id': appointment['id']
                            }
                        })
                        
                        processed_payments.append({
                            'appointment_id': appointment['id'],
                            'action': 'refunded',
                            'amount': payment['amount']
                        })
            else:
                # Doctor joined but didn't mark as completed, auto-complete and release payment
                Appointment.update_status(db, appointment['id'], 'completed')
                
                payment = Payment.find_by_appointment_id(db, appointment['id'])
                if payment and payment['payment_status'] == 'hold':
                    # Auto-approve and release payment
                    Payment.approve_for_release(db, payment['id'])
                    release_success = Payment.release_payment(db, payment['id'])
                    
                    if release_success:
                        # Notify doctor
                        Notification.create(db, {
                            'title': 'Payment Auto-Released',
                            'message': f"Payment of ₹{payment['amount']} auto-released for completed consultation",
                            'type': 'payment',
                            'userId': appointment['doctor_id'],
                            'relatedTo': {
                                'type': 'payment',
                                'id': payment['id']
                            }
                        })
                        
                        processed_payments.append({
                            'appointment_id': appointment['id'],
                            'action': 'released',
                            'amount': payment['amount']
                        })
        
        return jsonify({
            'message': f'Processed {len(processed_payments)} overdue payments',
            'processed_payments': processed_payments
        }), 200
        
    except Exception as e:
        logger.error(f"Process overdue payments error: {str(e)}")
        return jsonify({'error': 'Failed to process overdue payments'}), 500

@api_bp.route('/test/create-appointment', methods=['POST'])
def create_test_appointment():
    """Test endpoint to create an appointment for debugging slot availability"""
    try:
        data = request.get_json()
        
        # Required fields for test appointment
        required_fields = ['doctor_id', 'appointment_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        db = get_db()
        
        # Create test appointment data
        test_appointment_data = {
            'patient_id': 'test_patient_id',
            'patient_name': 'Test Patient',
            'patient_phone': '+1-555-TEST',
            'patient_email': 'test@example.com',
            'doctor_id': data['doctor_id'],
            'doctor_name': 'Test Doctor',
            'appointment_date': data['appointment_date'],
            'status': 'confirmed',  # Set as confirmed for testing
            'reason': 'Test appointment for slot availability debugging',
            'consultation_type': 'video',
            'urgent': False,
            'preferred_language': 'English',
            'medical_history': '',
            'report_complaint': '',
            'video_call_id': f"test_call_{int(datetime.utcnow().timestamp())}"
        }
        
        # Create the test appointment
        appointment = Appointment.create(db, test_appointment_data)
        
        logger.info(f"Test appointment created with ID: {appointment['id']}")
        
        return jsonify({
            'message': 'Test appointment created successfully',
            'appointment': appointment,
            'note': 'This is a test appointment. Use DELETE /api/test/appointments/{id} to remove it.'
        }), 201
        
    except Exception as e:
        logger.error(f"Create test appointment error: {str(e)}")
        return jsonify({'error': 'Failed to create test appointment'}), 500

@api_bp.route('/test/setup-doctor-availability/<doctor_id>', methods=['POST'])
def setup_test_doctor_availability(doctor_id):
    """Test endpoint to set up sample availability for a doctor"""
    try:
        db = get_db()
        
        # Verify doctor exists
        doctor = Doctor.find_by_id(db, doctor_id)
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        # Create sample availability - typical working hours Monday to Friday
        sample_availability = {
            'monday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '09:00', 'end_time': '12:00'},
                    {'start_time': '14:00', 'end_time': '17:00'}
                ]
            },
            'tuesday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '09:00', 'end_time': '12:00'},
                    {'start_time': '14:00', 'end_time': '17:00'}
                ]
            },
            'wednesday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '09:00', 'end_time': '12:00'},
                    {'start_time': '14:00', 'end_time': '17:00'}
                ]
            },
            'thursday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '09:00', 'end_time': '12:00'},
                    {'start_time': '14:00', 'end_time': '17:00'}
                ]
            },
            'friday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '09:00', 'end_time': '12:00'},
                    {'start_time': '14:00', 'end_time': '16:00'}
                ]
            },
            'saturday': {
                'is_available': True,
                'time_slots': [
                    {'start_time': '10:00', 'end_time': '13:00'}
                ]
            },
            'sunday': {
                'is_available': False,
                'time_slots': []
            }
        }
        
        # Create or update the availability
        availability = DoctorAvailability.create_or_update(db, doctor_id, sample_availability)
        
        logger.info(f"Sample availability created for doctor {doctor_id}")
        
        return jsonify({
            'message': 'Sample availability created successfully',
            'doctor_id': doctor_id,
            'doctor_name': doctor.get('name', 'Unknown'),
            'availability': availability,
            'note': 'This creates a standard Monday-Friday 9AM-12PM, 2PM-5PM schedule with Saturday mornings'
        }), 201
        
    except Exception as e:
        logger.error(f"Setup test doctor availability error: {str(e)}")
        return jsonify({'error': 'Failed to setup test availability'}), 500

@api_bp.route('/test/appointments/<appointment_id>', methods=['DELETE'])
def delete_test_appointment(appointment_id):
    """Delete a test appointment"""
    try:
        db = get_db()
        
        # Delete the appointment
        result = db[Appointment.collection_name].delete_one({'_id': ObjectId(appointment_id)})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Appointment not found'}), 404
        
        logger.info(f"Test appointment {appointment_id} deleted")
        
        return jsonify({
            'message': 'Test appointment deleted successfully',
            'appointment_id': appointment_id
        }), 200
        
    except Exception as e:
        logger.error(f"Delete test appointment error: {str(e)}")
        return jsonify({'error': 'Failed to delete test appointment'}), 500

# Enhanced appointment creation endpoint with comprehensive debugging
@api_bp.route('/appointments/create-with-payment', methods=['POST'])
def create_appointment_with_payment():
    """Create appointment and process payment in one request (for testing CheckoutPage flow)"""
    try:
        data = request.get_json()
        logger.info(f"Create appointment with payment request: {data}")
        
        # Extract authentication token if present
        token = None
        current_user = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
                # Try to decode token
                token_data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
                current_user = token_data
                logger.info(f"Authenticated user: {current_user.get('id')} ({current_user.get('role')})")
            except Exception as token_error:
                logger.warning(f"Token validation failed: {token_error}")
                # For testing, create a mock user
                current_user = {
                    'id': 'test_patient_id',
                    'email': data.get('patient_email', 'test@example.com'),
                    'role': 'patient'
                }
                logger.info(f"Using mock user for testing: {current_user}")
        else:
            # No token provided, create mock user for testing
            current_user = {
                'id': 'test_patient_id',
                'email': data.get('patient_email', 'test@example.com'),
                'role': 'patient'
            }
            logger.info(f"No token provided, using mock user: {current_user}")
        
        # Validate required fields
        required_fields = ['doctor_id', 'appointment_date', 'reason']
        missing_fields = []
        for field in required_fields:
            if not data.get(field):
                missing_fields.append(field)
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}',
                'missing_fields': missing_fields
            }), 400
        
        db = get_db()
        logger.info("Database connection established")
        
        # Verify doctor exists and is approved
        try:
            doctor = Doctor.find_by_id(db, data['doctor_id'])
            if not doctor:
                return jsonify({'error': 'Doctor not found'}), 404
            
            if doctor.get('verificationStatus') != 'approved':
                return jsonify({'error': 'Doctor not available for appointments'}), 400
            
            logger.info(f"Doctor verified: {doctor['name']} (ID: {doctor['id']})")
        except Exception as doctor_error:
            logger.error(f"Error verifying doctor: {doctor_error}")
            return jsonify({'error': 'Failed to verify doctor'}), 500
        
        # Create appointment data
        appointment_data = {
            'patient_id': current_user['id'],
            'patient_name': data.get('patient_name', current_user.get('email', 'Unknown')),
            'patient_phone': data.get('patient_phone', ''),
            'patient_email': data.get('patient_email', current_user.get('email', '')),
            'doctor_id': data['doctor_id'],
            'doctor_name': data.get('doctor_name', doctor.get('name', 'Unknown')),
            'appointment_date': data['appointment_date'],
            'status': 'pending',
            'reason': data['reason'],
            'notes': data.get('notes', ''),
            'consultation_type': data.get('consultation_type', 'video'),
            'urgent': data.get('urgent', False),
            'preferred_language': data.get('preferred_language', 'English'),
            'medical_history': data.get('medical_history', ''),
            'report_complaint': data.get('report_complaint', ''),
            'video_call_id': data.get('video_call_id', f"call_{int(datetime.utcnow().timestamp())}")
        }
        
        logger.info(f"Creating appointment with data: {appointment_data}")
        
        # Create the appointment
        try:
            appointment = Appointment.create(db, appointment_data)
            logger.info(f"Appointment created successfully with ID: {appointment.get('id')}")
        except Exception as create_error:
            logger.error(f"Error creating appointment: {create_error}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return jsonify({'error': 'Failed to create appointment', 'details': str(create_error)}), 500
        
        # Process payment if amount is provided
        payment_result = None
        if data.get('amount') and float(data.get('amount', 0)) > 0:
            try:
                logger.info(f"Processing payment for appointment {appointment['id']}")
                
                # Generate transaction ID
                transaction_id = Payment.generate_transaction_id()
                
                # Create payment record
                payment_data = {
                    'appointment_id': appointment['id'],
                    'patient_id': current_user['id'],
                    'patient_name': appointment_data['patient_name'],
                    'doctor_id': appointment['doctor_id'],
                    'doctor_name': appointment_data['doctor_name'],
                    'amount': float(data['amount']),
                    'currency': data.get('currency', 'INR'),
                    'payment_method': data.get('payment_method', 'credit'),
                    'payment_type': 'consultation',
                    'status': 'processing',
                    'payment_status': 'hold',
                    'transaction_id': transaction_id,
                    'payment_gateway': 'dummy',
                    'payment_data': data.get('payment_data', {})
                }
                
                payment = Payment.create(db, payment_data)
                logger.info(f"Payment record created with ID: {payment['id']}")
                
                # Simulate payment processing (replace with real payment gateway)
                import time
                time.sleep(0.5)  # Simulate processing time
                
                # For demo purposes, assume payment is successful
                success = True
                
                if success:
                    # Update payment status to completed
                    Payment.update_status(db, payment['id'], 'completed', transaction_id)
                    
                    # Update appointment status to confirmed (payment received)
                    Appointment.update_status(db, appointment['id'], 'confirmed')
                    
                    payment_result = {
                        'payment_id': payment['id'],
                        'transaction_id': transaction_id,
                        'status': 'completed',
                        'amount': payment_data['amount']
                    }
                    
                    logger.info(f"Payment processed successfully: {payment_result}")
                else:
                    Payment.update_status(db, payment['id'], 'failed')
                    payment_result = {
                        'payment_id': payment['id'],
                        'status': 'failed',
                        'error': 'Payment processing failed'
                    }
                    
            except Exception as payment_error:
                logger.error(f"Error processing payment: {payment_error}")
                import traceback
                logger.error(f"Payment error traceback: {traceback.format_exc()}")
                payment_result = {
                    'status': 'failed',
                    'error': str(payment_error)
                }
        
        # Create notifications (wrapped in try-catch to prevent cascade failures)
        try:
            # Create notification for the doctor
            Notification.create(db, {
                'title': 'New Appointment Request',
                'message': f"Patient {appointment_data['patient_name']} has requested an appointment",
                'type': 'appointment',
                'userId': data['doctor_id'],
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment['id']
                }
            })
            
            # Create notification for admin
            Notification.create(db, {
                'title': 'New Appointment Request',
                'message': f"New appointment request between {appointment_data['patient_name']} and Dr. {appointment_data['doctor_name']}",
                'type': 'appointment',
                'userId': 'admin',
                'relatedTo': {
                    'type': 'appointment',
                    'id': appointment['id']
                }
            })
        except Exception as notif_error:
            logger.warning(f"Error creating notifications: {notif_error}")
        
        # Return success response
        response_data = {
            'message': 'Appointment and payment processed successfully',
            'appointment': appointment,
            'payment': payment_result,
            'success': True
        }
        
        logger.info(f"Request completed successfully: {response_data}")
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Create appointment with payment error: {str(e)}")
        import traceback
        logger.error(f"Full error traceback: {traceback.format_exc()}")
        return jsonify({
            'error': 'Failed to process appointment and payment',
            'details': str(e),
            'success': False
        }), 500

# Get doctor's payment history
@doctor_bp.route('/payments/history', methods=['GET'])
@doctor_required
def get_doctor_payment_history(current_user):
    """Get payment history for the doctor"""
    try:
        db = get_db()
        doctor_id = current_user['id']
        
        # Get all payments for this doctor's appointments
        payments = list(db.payments.find({
            'doctor_id': doctor_id
        }).sort('created_at', -1))
        
        # Convert ObjectId to string and format the data
        for payment in payments:
            payment['id'] = str(payment['_id'])
            payment.pop('_id', None)
            
            # Get appointment details
            if payment.get('appointment_id'):
                try:
                    appointment = db.appointments.find_one({'_id': ObjectId(payment['appointment_id'])})
                    if appointment:
                        payment['appointment_details'] = {
                            'appointment_date': appointment.get('appointment_date'),
                            'consultation_type': appointment.get('consultation_type'),
                            'status': appointment.get('status'),
                            'reason': appointment.get('reason'),
                            'patient_name': appointment.get('patient_name'),
                            'patient_email': appointment.get('patient_email')
                        }
                except:
                    payment['appointment_details'] = None
        
        return jsonify({
            'success': True,
            'payments': payments,
            'total_count': len(payments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor payment history error: {str(e)}")
        return jsonify({'error': 'Failed to fetch payment history'}), 500

# Get doctor's payment statistics
@doctor_bp.route('/payments/stats', methods=['GET'])
@doctor_required
def get_doctor_payment_stats(current_user):
    """Get payment statistics for the doctor"""
    try:
        db = get_db()
        doctor_id = current_user['id']
        
        # Aggregate payment statistics
        pipeline = [
            {'$match': {'doctor_id': doctor_id}},
            {'$group': {
                '_id': '$payment_status',
                'count': {'$sum': 1},
                'total_amount': {'$sum': '$amount'}
            }}
        ]
        
        stats_result = list(db.payments.aggregate(pipeline))
        
        # Initialize stats
        stats = {
            'total_earnings': 0,
            'pending_amount': 0,
            'completed_amount': 0,
            'on_hold_amount': 0,
            'total_appointments': 0,
            'pending_count': 0,
            'completed_count': 0,
            'on_hold_count': 0
        }
        
        # Process aggregated results
        for stat in stats_result:
            status = stat['_id']
            count = stat['count']
            amount = stat['total_amount']
            
            stats['total_appointments'] += count
            stats['total_earnings'] += amount
            
            if status == 'completed':
                stats['completed_amount'] = amount
                stats['completed_count'] = count
            elif status == 'hold':
                stats['on_hold_amount'] = amount
                stats['on_hold_count'] = count
            elif status == 'pending':
                stats['pending_amount'] = amount
                stats['pending_count'] = count
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor payment stats error: {str(e)}")
        return jsonify({'error': 'Failed to fetch payment statistics'}), 500

# Get specific appointment payment details
@doctor_bp.route('/payments/appointment/<appointment_id>', methods=['GET'])
@doctor_required
def get_appointment_payment_details(current_user, appointment_id):
    """Get payment details for a specific appointment"""
    try:
        db = get_db()
        doctor_id = current_user['id']
        
        # Verify the appointment belongs to this doctor
        appointment = db.appointments.find_one({
            '_id': ObjectId(appointment_id),
            'doctor_id': doctor_id
        })
        
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        # Get payment details for this appointment
        payment = db.payments.find_one({'appointment_id': appointment_id})
        
        if not payment:
            return jsonify({
                'success': True,
                'payment': None,
                'message': 'No payment record found for this appointment'
            }), 200
        
        # Format payment data
        payment['id'] = str(payment['_id'])
        payment.pop('_id', None)
        
        # Add appointment details
        payment['appointment_details'] = {
            'appointment_date': appointment.get('appointment_date'),
            'consultation_type': appointment.get('consultation_type'),
            'status': appointment.get('status'),
            'reason': appointment.get('reason'),
            'patient_name': appointment.get('patient_name'),
            'patient_email': appointment.get('patient_email')
        }
        
        return jsonify({
            'success': True,
            'payment': payment
        }), 200
        
    except Exception as e:
        logger.error(f"Get appointment payment details error: {str(e)}")
        return jsonify({'error': 'Failed to fetch payment details'}), 500

# Test endpoint for payment history (no authentication required)
@api_bp.route('/test/doctor/payments/history/<doctor_id>', methods=['GET'])
def test_doctor_payment_history(doctor_id):
    """Test endpoint to get payment history for a doctor without authentication"""
    try:
        db = get_db()
        
        # Get all payments for this doctor's appointments
        payments = list(db.payments.find({
            'doctor_id': doctor_id
        }).sort('created_at', -1))
        
        # Convert ObjectId to string and format the data
        for payment in payments:
            payment['id'] = str(payment['_id'])
            payment.pop('_id', None)
            
            # Get appointment details
            if payment.get('appointment_id'):
                try:
                    appointment = db.appointments.find_one({'_id': ObjectId(payment['appointment_id'])})
                    if appointment:
                        payment['appointment_details'] = {
                            'appointment_date': appointment.get('appointment_date'),
                            'consultation_type': appointment.get('consultation_type'),
                            'status': appointment.get('status'),
                            'reason': appointment.get('reason'),
                            'patient_name': appointment.get('patient_name'),
                            'patient_email': appointment.get('patient_email')
                        }
                except:
                    payment['appointment_details'] = None
        
        return jsonify({
            'success': True,
            'payments': payments,
            'total_count': len(payments),
            'note': 'This is a test endpoint. Use the authenticated endpoint in production.'
        }), 200
        
    except Exception as e:
        logger.error(f"Test doctor payment history error: {str(e)}")
        return jsonify({'error': 'Failed to fetch payment history'}), 500

@doctor_bp.route('/appointments/upcoming-notifications', methods=['GET'])
@doctor_required
def get_doctor_upcoming_notifications(current_user):
    """Get upcoming appointment notifications for doctor"""
    try:
        db = get_db()
        
        # Get current time and time 15 minutes from now
        now = datetime.utcnow()
        fifteen_mins_future = now + timedelta(minutes=15)
        
        # Find confirmed appointments that are starting within the next 15 minutes
        appointments = list(db[Appointment.collection_name].find({
            'doctor_id': current_user['id'],
            'status': 'confirmed',
            'appointment_date': {
                '$gt': now.isoformat(),
                '$lte': fifteen_mins_future.isoformat()
            }
        }).sort('appointment_date', 1))
        
        appointments = Appointment.serialize_list(appointments)
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get doctor upcoming notifications error: {str(e)}")
        return jsonify({'error': 'Failed to fetch upcoming notifications'}), 500

@patient_bp.route('/appointments/upcoming-notifications', methods=['GET'])
@patient_required
def get_patient_upcoming_notifications(current_user):
    """Get upcoming appointment notifications for patient"""
    try:
        db = get_db()
        
        # Get current time and time 15 minutes from now
        now = datetime.utcnow()
        fifteen_mins_future = now + timedelta(minutes=15)
        
        # Find confirmed appointments that are starting within the next 15 minutes
        appointments = list(db[Appointment.collection_name].find({
            'patient_id': current_user['id'],
            'status': 'confirmed',
            'appointment_date': {
                '$gt': now.isoformat(),
                '$lte': fifteen_mins_future.isoformat()
            }
        }).sort('appointment_date', 1))
        
        appointments = Appointment.serialize_list(appointments)
        
        return jsonify({
            'appointments': appointments,
            'count': len(appointments)
        }), 200
        
    except Exception as e:
        logger.error(f"Get patient upcoming notifications error: {str(e)}")
        return jsonify({'error': 'Failed to fetch upcoming notifications'}), 500

# WebRTC Signaling Routes
@api_bp.route('/webrtc/rooms/<room_id>', methods=['GET'])
@token_required
def get_room_status(current_user, room_id):
    """Get status of a WebRTC room"""
    try:
        db = get_db()
        
        # Get room details using the model
        room = WebRTCRoom.find_by_room_id(db, room_id)
        
        if not room:
            return jsonify({
                'room_id': room_id,
                'exists': False,
                'participants': 0
            }), 200
            
        # Check if user is allowed in this room
        appointment_id = room.get('appointment_id')
        if appointment_id:
            # Get appointment details
            appointment = Appointment.find_by_id(db, appointment_id)
            if not appointment:
                return jsonify({'error': 'Associated appointment not found'}), 404
                
            # Check if user is part of this appointment
            if (current_user['role'] == 'patient' and str(appointment['patient_id']) != str(current_user['id']) or
                current_user['role'] == 'doctor' and str(appointment['doctor_id']) != str(current_user['id'])):
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'room_id': room_id,
            'exists': True,
            'created_at': room.get('created_at'),
            'participants': len(room.get('participants', [])),
            'participant_ids': [str(p.get('user_id')) for p in room.get('participants', [])],
            'appointment_id': room.get('appointment_id')
        }), 200
        
    except Exception as e:
        logger.error(f"Get room status error: {str(e)}")
        return jsonify({'error': 'Failed to get room status'}), 500

@api_bp.route('/webrtc/rooms/<room_id>/join', methods=['POST'])
@token_required
def join_webrtc_room(current_user, room_id):
    """Join a WebRTC room with authentication"""
    try:
        db = get_db()
        now = datetime.utcnow()
        
        # Check if room exists using the model
        room = WebRTCRoom.find_by_room_id(db, room_id)
        
        if not room:
            # Create new room
            appointment_id = request.json.get('appointment_id')
            
            # If appointment_id provided, verify user has access
            if appointment_id:
                appointment = Appointment.find_by_id(db, appointment_id)
                if not appointment:
                    return jsonify({'error': 'Appointment not found'}), 404
                    
                # Check if user is part of this appointment
                if (current_user['role'] == 'patient' and str(appointment['patient_id']) != str(current_user['id']) or
                    current_user['role'] == 'doctor' and str(appointment['doctor_id']) != str(current_user['id'])):
                    return jsonify({'error': 'Access denied'}), 403
                    
                # Set room metadata
                room_data = {
                    'room_id': room_id,
                    'created_by': current_user['id'],
                    'appointment_id': appointment_id,
                    'allowed_users': [
                        str(appointment['doctor_id']),
                        str(appointment['patient_id'])
                    ]
                }
                
                room = WebRTCRoom.create(db, room_data)
                logger.info(f"Created new WebRTC room: {room_id} for appointment: {appointment_id}")
            else:
                return jsonify({'error': 'Appointment ID required'}), 400
        
        # Check if user is allowed in this room
        appointment_id = room.get('appointment_id')
        if appointment_id:
            appointment = Appointment.find_by_id(db, appointment_id)
            if appointment:
                if (current_user['role'] == 'patient' and str(appointment['patient_id']) != str(current_user['id']) or
                    current_user['role'] == 'doctor' and str(appointment['doctor_id']) != str(current_user['id'])):
                    return jsonify({'error': 'Access denied to this room'}), 403
        
        # Generate unique participant ID
        participant_id = f"{current_user['id']}_{int(time.time())}"
        
        # Add user to room participants
        participant = {
            'participant_id': participant_id,
            'user_id': current_user['id'],
            'user_role': current_user['role'],
            'user_name': current_user.get('name', current_user.get('email', 'Unknown')),
            'joined_at': now.isoformat()
        }
        
        # Add participant to room using the model
        WebRTCRoom.add_participant(db, room_id, participant)
        
        # For appointment tracking, mark user as joined
        if appointment_id:
            field_to_update = 'doctor_joined' if current_user['role'] == 'doctor' else 'patient_joined'
            db.appointments.update_one(
                {'_id': ObjectId(appointment_id)},
                {'$set': {field_to_update: True}}
            )
        
        # Return room details
        return jsonify({
            'room_id': room_id,
            'participant_id': participant_id,
            'user_id': current_user['id'],
            'user_role': current_user['role'],
            'user_name': participant['user_name'],
            'appointment_id': appointment_id,
            'joined_at': now.isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Join WebRTC room error: {str(e)}")
        return jsonify({'error': 'Failed to join room'}), 500

@api_bp.route('/webrtc/rooms/<room_id>/signal', methods=['POST'])
@token_required
def send_webrtc_signal(current_user, room_id):
    """Send WebRTC signaling message to peers in the room"""
    try:
        db = get_db()
        
        # Get room details using the model
        room = WebRTCRoom.find_by_room_id(db, room_id)
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Check if user is part of this room
        user_in_room = False
        for participant in room.get('participants', []):
            if str(participant.get('user_id')) == str(current_user['id']):
                user_in_room = True
                break
                
        if not user_in_room:
            return jsonify({'error': 'You are not in this room'}), 403
        
        # Get signaling data
        data = request.get_json()
        if not data or not data.get('signal'):
            return jsonify({'error': 'Signal data is required'}), 400
            
        # Add metadata
        signal_data = {
            'user_id': current_user['id'],
            'user_role': current_user['role'],
            'timestamp': datetime.utcnow().isoformat(),
            'signal': data.get('signal'),
            'target_user_id': data.get('target_user_id')  # Optional, for direct messages
        }
        
        # Store the signal using the model
        WebRTCRoom.add_message(db, room_id, signal_data)
        
        return jsonify({
            'success': True,
            'message': 'Signal sent successfully',
            'timestamp': signal_data['timestamp']
        }), 200
        
    except Exception as e:
        logger.error(f"Send WebRTC signal error: {str(e)}")
        return jsonify({'error': 'Failed to send signal'}), 500

@api_bp.route('/webrtc/rooms/<room_id>/messages', methods=['GET'])
@token_required
def get_webrtc_messages(current_user, room_id):
    """Get WebRTC signaling messages for a room"""
    try:
        db = get_db()
        
        # Get time parameters
        since = request.args.get('since')  # ISO timestamp
        
        # Get room details using the model
        room = WebRTCRoom.find_by_room_id(db, room_id)
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Check if user is part of this room
        user_in_room = False
        for participant in room.get('participants', []):
            if str(participant.get('user_id')) == str(current_user['id']):
                user_in_room = True
                break
                
        if not user_in_room:
            return jsonify({'error': 'You are not in this room'}), 403
        
        # Get messages using the model
        messages = WebRTCRoom.get_messages_since(db, room_id, since)
        
        # Filter messages for this user
        filtered_messages = [
            msg for msg in messages
            if not msg.get('target_user_id') or 
            str(msg.get('target_user_id')) == str(current_user['id']) or
            str(msg.get('user_id')) == str(current_user['id'])
        ]
        
        return jsonify({
            'room_id': room_id,
            'messages': filtered_messages,
            'count': len(filtered_messages),
            'total_messages': len(messages),
            'server_time': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Get WebRTC messages error: {str(e)}")
        return jsonify({'error': 'Failed to get messages'}), 500

@api_bp.route('/webrtc/rooms/<room_id>/leave', methods=['POST'])
@token_required
def leave_webrtc_room(current_user, room_id):
    """Leave a WebRTC room"""
    try:
        db = get_db()
        
        # Remove participant using the model
        result = WebRTCRoom.remove_participant(db, room_id, current_user['id'])
        
        if not result:
            return jsonify({'message': 'User not in room or room not found'}), 200
        
        # Check if room is now empty
        room = WebRTCRoom.find_by_room_id(db, room_id)
        if room and len(room.get('participants', [])) == 0:
            # Update room status to inactive
            WebRTCRoom.update_status(db, room_id, 'inactive')
        
        return jsonify({
            'success': True,
            'message': 'Successfully left the room'
        }), 200
        
    except Exception as e:
        logger.error(f"Leave WebRTC room error: {str(e)}")
        return jsonify({'error': 'Failed to leave room'}), 500

@api_bp.route('/webrtc/stats', methods=['GET'])
@token_required
def get_webrtc_stats(current_user):
    """Get statistics about active WebRTC rooms (admin only)"""
    try:
        # Only admins or system monitoring can access this endpoint
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        db = get_db()
        
        # Get all active rooms
        active_rooms = list(db.webrtc_rooms.find({'status': 'active'}))
        
        # Get count of rooms with participants
        rooms_with_participants = [room for room in active_rooms if len(room.get('participants', [])) > 0]
        
        # Count total participants
        total_participants = sum(len(room.get('participants', [])) for room in active_rooms)
        
        # Get rooms by appointment type
        room_stats = []
        for room in rooms_with_participants:
            appointment_id = room.get('appointment_id')
            if appointment_id:
                appointment = Appointment.find_by_id(db, appointment_id)
                if appointment:
                    room_stats.append({
                        'room_id': room.get('room_id'),
                        'appointment_id': appointment_id,
                        'consultation_type': appointment.get('consultation_type', 'unknown'),
                        'created_at': room.get('created_at'),
                        'participants': len(room.get('participants', [])),
                        'doctor_name': appointment.get('doctor_name', 'Unknown'),
                        'patient_name': appointment.get('patient_name', 'Unknown')
                    })
        
        return jsonify({
            'total_active_rooms': len(active_rooms),
            'rooms_with_participants': len(rooms_with_participants),
            'total_participants': total_participants,
            'active_calls': room_stats,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Get WebRTC stats error: {str(e)}")
        return jsonify({'error': 'Failed to get WebRTC statistics'}), 500

@api_bp.route('/webrtc/rooms/<appointment_id>/status', methods=['GET'])
@token_required
def get_appointment_call_status(current_user, appointment_id):
    """Get WebRTC call status for a specific appointment"""
    try:
        db = get_db()
        
        # Verify user can access this appointment
        appointment = Appointment.find_by_id(db, appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
            
        if (current_user['role'] == 'patient' and str(appointment['patient_id']) != str(current_user['id']) or
            current_user['role'] == 'doctor' and str(appointment['doctor_id']) != str(current_user['id'])):
            if current_user['role'] != 'admin':
                return jsonify({'error': 'Access denied'}), 403
        
        # Find active room for this appointment
        room = WebRTCRoom.find_by_appointment_id(db, appointment_id)
        
        if not room or room.get('status') != 'active':
            return jsonify({
                'appointment_id': appointment_id,
                'has_active_call': False,
                'room_id': None,
                'participants': 0
            }), 200
        
        # Get participant details
        participants = room.get('participants', [])
        doctor_joined = any(p.get('user_role') == 'doctor' for p in participants)
        patient_joined = any(p.get('user_role') == 'patient' for p in participants)
        
        # Format response data
        response_data = {
            'appointment_id': appointment_id,
            'has_active_call': True,
            'room_id': room.get('room_id'),
            'participants': len(participants),
            'doctor_joined': doctor_joined,
            'patient_joined': patient_joined,
            'created_at': room.get('created_at'),
            'doctor_name': appointment.get('doctor_name', 'Unknown Doctor'),
            'patient_name': appointment.get('patient_name', 'Unknown Patient')
        }
        
        # Add time since creation if available
        if room.get('created_at'):
            try:
                created_at = datetime.fromisoformat(room['created_at'].replace('Z', ''))
                now = datetime.utcnow()
                duration_seconds = (now - created_at).total_seconds()
                response_data['call_duration_seconds'] = duration_seconds
                response_data['call_duration_minutes'] = int(duration_seconds / 60)
            except:
                pass
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Get appointment call status error: {str(e)}")
        return jsonify({'error': 'Failed to get call status'}), 500