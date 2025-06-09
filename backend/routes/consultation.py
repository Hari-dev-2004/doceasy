from flask import Blueprint, request, jsonify
import time
from bson import ObjectId
from datetime import datetime, timedelta
from database import db
import os

consultation_bp = Blueprint('consultation', __name__)

@consultation_bp.route('/api/consultations/join/<consultation_id>', methods=['GET'])
def join_consultation(consultation_id):
    try:
        # Get user info from token
        user_id = request.user_id  # Assuming you have middleware that sets this
        user_role = request.user_role
        
        # Find consultation in database
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id)
        })
        
        if not consultation:
            # If consultation doesn't exist yet, check if it's an appointment ID
            appointment = db.appointments.find_one({
                '_id': ObjectId(consultation_id)
            })
            
            if not appointment:
                return jsonify({
                    'error': 'Consultation not found',
                    'details': 'No active consultation found with this ID'
                }), 404
                
            # Check if appointment is confirmed
            if appointment.get('status') != 'confirmed':
                return jsonify({
                    'error': 'Consultation not ready',
                    'details': 'The appointment must be confirmed before joining the consultation',
                    'status': appointment.get('status')
                }), 403
            
            # Validate user has permission to join this appointment
            if (user_role == 'doctor' and user_id != appointment.get('doctor_id')) or \
               (user_role == 'patient' and user_id != appointment.get('patient_id')):
                return jsonify({
                    'error': 'Access denied',
                    'details': 'You are not authorized to join this consultation'
                }), 403
            
            # Check if this is an immediate appointment
            is_immediate = appointment.get('is_immediate', False)
            
            # Get consultation time
            appointment_time = datetime.fromisoformat(
                appointment.get('appointment_date').replace('Z', '').replace('T', ' ').split('.')[0]
            )
            current_time = datetime.utcnow()
            
            # Check if within time window to join (15 minutes before scheduled time or 30 minutes after)
            time_diff_minutes = (appointment_time - current_time).total_seconds() / 60
            
            # Allow immediate consultations to be joined at any time after confirmation
            if not is_immediate and (time_diff_minutes > 15 or time_diff_minutes < -30):
                return jsonify({
                    'error': 'Outside consultation window',
                    'details': 'You can join the consultation 15 minutes before or up to 30 minutes after the scheduled time',
                    'scheduled_time': appointment.get('appointment_date'),
                    'current_time': current_time.isoformat(),
                    'minutes_until_window': time_diff_minutes - 15 if time_diff_minutes > 15 else None
                }), 403
            
            # Ensure video_call_id exists and is consistent
            # If not present, create one based on the appointment ID to ensure consistency
            video_call_id = appointment.get('video_call_id')
            if not video_call_id:
                video_call_id = f"call_{str(appointment.get('_id'))}"
                # Update the appointment with the consistent video_call_id
                db.appointments.update_one(
                    {'_id': ObjectId(appointment.get('_id'))},
                    {'$set': {'video_call_id': video_call_id}}
                )
            
            # Create consultation record
            consultation_data = {
                'appointment_id': str(appointment.get('_id')),
                'patient_id': appointment.get('patient_id'),
                'doctor_name': appointment.get('doctor_name'),
                'patient_name': appointment.get('patient_name'),
                'doctor_id': appointment.get('doctor_id'),
                'scheduled_time': appointment.get('appointment_date'),
                'start_time': datetime.utcnow().isoformat(),
                'end_time': None,
                'status': 'active',
                'notes': '',
                'consultation_type': appointment.get('consultation_type', 'video'),
                'video_call_id': video_call_id,  # Use the consistent video_call_id
                'is_immediate': is_immediate,
                # Store user IDs as strings to ensure consistent formatting
                'authorized_users': [
                    str(appointment.get('doctor_id')),
                    str(appointment.get('patient_id'))
                ]
            }
            
            # Insert consultation record
            result = db.consultations.insert_one(consultation_data)
            consultation_id = str(result.inserted_id)
            
            # Update the appointment with the consultation ID
            db.appointments.update_one(
                {'_id': ObjectId(appointment.get('_id'))},
                {'$set': {
                    'consultation_id': consultation_id,
                    'last_updated': datetime.utcnow().isoformat()
                }}
            )
            
            # Log the consultation creation
            print(f"Created consultation {consultation_id} for appointment {appointment.get('_id')} with video_call_id {video_call_id}")
            
            # Return the consultation data needed for the UI
            return jsonify({
                'consultation_id': consultation_id,
                'video_call_id': video_call_id,
                'consultation_type': consultation_data['consultation_type'],
                'is_immediate': is_immediate,
                'patient_id': str(appointment.get('patient_id')),
                'doctor_id': str(appointment.get('doctor_id')),
                'user_role': user_role
            }), 201
        
        # Consultation exists, strictly verify user authorization
        if str(user_id) not in [str(consultation.get('patient_id')), str(consultation.get('doctor_id'))]:
            # Log unauthorized attempt
            print(f"Unauthorized access attempt: User {user_id} ({user_role}) tried to join consultation {consultation_id}")
            # Record the attempt in the database for security monitoring
            db.security_logs.insert_one({
                'event': 'unauthorized_consultation_access',
                'user_id': str(user_id),
                'user_role': user_role,
                'consultation_id': consultation_id,
                'timestamp': datetime.utcnow().isoformat()
            })
            return jsonify({
                'error': 'Access denied',
                'details': 'You are not authorized to join this consultation'
            }), 403
        
        # Check if consultation is active
        if consultation.get('status') != 'active':
            return jsonify({
                'error': 'Consultation not active',
                'details': f"Consultation status is {consultation.get('status')}",
                'consultation_data': {
                    'status': consultation.get('status'),
                    'end_time': consultation.get('end_time')
                }
            }), 403
        
        # Ensure video_call_id is set
        video_call_id = consultation.get('video_call_id')
        if not video_call_id:
            # If missing, create one based on consultation ID and update
            video_call_id = f"call_{consultation_id}"
            db.consultations.update_one(
                {'_id': ObjectId(consultation_id)},
                {'$set': {'video_call_id': video_call_id}}
            )
        
        # Log successful join attempt
        print(f"User {user_id} ({user_role}) successfully joined consultation {consultation_id}")
        
        # Return the consultation data needed for the UI
        return jsonify({
            'consultation_id': str(consultation.get('_id')),
            'video_call_id': video_call_id,  # Always use the same video_call_id
            'consultation_type': consultation.get('consultation_type', 'video'),
            'start_time': consultation.get('start_time'),
            'scheduled_time': consultation.get('scheduled_time'),
            'is_immediate': consultation.get('is_immediate', False),
            'patient_id': str(consultation.get('patient_id')),
            'doctor_id': str(consultation.get('doctor_id')),
            'user_role': user_role
        }), 200
        
    except Exception as e:
        print(f"Join consultation error: {str(e)}")
        return jsonify({
            'error': 'Server error',
            'details': str(e)
        }), 500

@consultation_bp.route('/api/consultations/<consultation_id>/complete', methods=['PUT'])
def complete_consultation(consultation_id):
    try:
        # Get user info from token
        user_id = request.user_id
        user_role = request.user_role
        
        # Only doctors can mark consultations as complete
        if user_role != 'doctor':
            return jsonify({
                'error': 'Only doctors can mark consultations as complete'
            }), 403
            
        # Find and update consultation
        result = db.consultations.update_one(
            {
                '_id': ObjectId(consultation_id),
                'doctor_id': ObjectId(user_id)
            },
            {
                '$set': {
                    'status': 'completed',
                    'completed_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({
                'error': 'Consultation not found or unauthorized'
            }), 404
            
        return jsonify({
            'message': 'Consultation marked as completed'
        })
        
    except Exception as e:
        print('Error in complete_consultation:', str(e))
        return jsonify({
            'error': 'Failed to complete consultation'
        }), 500

@consultation_bp.route('/api/consultations/<consultation_id>/notes', methods=['PUT'])
def update_consultation_notes(consultation_id):
    try:
        # Get user info from token
        user_id = request.user_id
        user_role = request.user_role
        
        # Get notes from request
        notes = request.json.get('notes', '')
        
        # Find consultation
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id)
        })
        
        if not consultation:
            return jsonify({
                'error': 'Consultation not found'
            }), 404
            
        # Check authorization
        if user_role == 'doctor' and str(consultation['doctor_id']) != str(user_id):
            return jsonify({
                'error': 'Unauthorized to update notes'
            }), 403
            
        if user_role == 'patient' and str(consultation['patient_id']) != str(user_id):
            return jsonify({
                'error': 'Unauthorized to update notes'
            }), 403
            
        # Update notes
        db.consultations.update_one(
            {'_id': ObjectId(consultation_id)},
            {'$set': {'notes': notes}}
        )
        
        return jsonify({
            'message': 'Notes updated successfully'
        })
        
    except Exception as e:
        print('Error in update_consultation_notes:', str(e))
        return jsonify({
            'error': 'Failed to update consultation notes'
        }), 500 