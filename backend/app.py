import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_mail import Mail
from flask_socketio import SocketIO, emit, join_room, leave_room
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import timedelta
import logging
from models import Admin, WebRTCRoom
from routes import auth_bp, admin_bp, api_bp, doctor_bp, patient_bp, payment_bp
import time
import jwt

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to load .env file, but continue if it fails
try:
    load_dotenv()
except Exception as e:
    logger.warning(f"Could not load .env file: {e}")

# Initialize Socket.IO outside the app factory
socketio = SocketIO(cors_allowed_origins="*", logger=True, engineio_logger=True)

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Configuration with extended JWT expiration for payment flow
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
    # Extended token expiration to 7 days (168 hours) to prevent session expiry during payment
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 168)))
    
    # Frontend URL for email links
    app.config['FRONTEND_URL'] = os.getenv('FRONTEND_URL', 'https://doceasy-1.onrender.com')
    
    # Flask-Mail configuration
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', 'doceasy4@gmail.com')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', 'ryft lfyj qvko xobz')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
    
    # Initialize Flask-Mail
    mail = Mail(app)
    
    # MongoDB configuration
    # Use MongoDB Atlas URI in production, local MongoDB in development
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb+srv://subrahmanyag79:dhDShm338VxoPMUz@doceasy.kp4oh2g.mongodb.net/?retryWrites=true&w=majority&appName=doceasy')
    mongodb_db_name = os.getenv('MONGODB_DB_NAME', 'doceasy')
    
    # Connect to MongoDB
    try:
        # Explicitly use the Atlas URI
        client = MongoClient(mongodb_uri)
        # Get the database by name instead of default
        db = client[mongodb_db_name]
        app.config['DATABASE'] = db
        
        # Test connection
        client.admin.command('ping')
        logger.info(f"Connected to MongoDB database: {mongodb_db_name} at {mongodb_uri}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # Don't raise the exception, allow the app to start anyway
        # This helps with debugging connection issues
        app.config['DATABASE'] = None
    
    # CORS configuration - allow production frontend and development origins
    cors_origins = os.getenv('CORS_ORIGIN', 'https://doceasy-1.onrender.com,http://localhost:5173,http://localhost:8080,http://localhost:3000').split(',')
    CORS(app, 
         origins=cors_origins,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         supports_credentials=True
    )
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(doctor_bp, url_prefix='/api/doctor')
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(patient_bp, url_prefix='/api/patient')
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    
    # Initialize Socket.IO with the app
    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')
    
    # Create default admin user if database is connected
    if app.config['DATABASE'] is not None:
        with app.app_context():
            create_default_admin(db)
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'message': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal error: {error}")
        return jsonify({'message': 'Internal server error'}), 500
    
    # Health check endpoint with explicit CORS headers
    @app.route('/health', methods=['GET', 'OPTIONS'])
    def health_check():
        if request.method == 'OPTIONS':
            # Handle preflight request
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
            return response
            
        try:
            # Check database connection if available
            if app.config['DATABASE'] is not None:
                app.config['DATABASE'].list_collection_names()
                db_status = 'connected'
            else:
                db_status = 'not configured'
                
            return jsonify({
                'status': 'healthy',
                'database': db_status,
                'mongodb_uri': mongodb_uri[:20] + '...' if mongodb_uri else 'not set',
                'jwt_expiry_hours': int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 168))
            }), 200
        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': str(e)
            }), 503
    
    return app

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'status': 'connected', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('authenticate')
def handle_authenticate(data):
    """Authenticate user via JWT token"""
    try:
        token = data.get('token')
        if not token:
            logger.warning(f"Authentication failed: No token provided from {request.sid}")
            emit('auth_error', {'error': 'No token provided'})
            return
        
        # Get JWT secret key from app config
        from flask import current_app
        jwt_secret = current_app.config['JWT_SECRET_KEY']
        
        # Verify token
        user_data = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        user_id = user_data.get('user_id')
        user_role = user_data.get('role')
        
        # Store user info in session
        socketio.server.save_session(request.sid, {'user_id': user_id, 'user_role': user_role})
        
        logger.info(f"User authenticated: {user_id}, {user_role}")
        emit('authenticated', {'status': 'success', 'user_id': user_id, 'user_role': user_role})
    
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        emit('auth_error', {'error': str(e)})

@socketio.on('join_room')
def handle_join_room(data):
    """Join a WebRTC room"""
    try:
        # Get user info from session
        user_session = socketio.server.get_session(request.sid)
        if not user_session:
            emit('room_error', {'error': 'Not authenticated'})
            return
        
        user_id = user_session.get('user_id')
        user_role = user_session.get('user_role')
        room_id = data.get('room_id')
        
        if not room_id:
            emit('room_error', {'error': 'Room ID is required'})
            return
        
        # Join the Socket.IO room
        join_room(room_id)
        logger.info(f"User {user_id} joined room: {room_id}")
        
        # Get DB instance
        from flask import current_app
        db = current_app.config['DATABASE']
        
        # Add to WebRTC room in database
        participant = {
            'socket_id': request.sid,
            'user_id': user_id,
            'user_role': user_role,
            'joined_at': time.time()
        }
        
        # Create room if it doesn't exist
        room = WebRTCRoom.find_by_room_id(db, room_id)
        if not room:
            room_data = {
                'room_id': room_id,
                'created_by': user_id,
                'status': 'active',
                'participants': [],
                'messages': []
            }
            WebRTCRoom.create(db, room_data)
        
        # Add participant
        WebRTCRoom.add_participant(db, room_id, participant)
        
        # Notify others in the room
        emit('user_joined', {
            'user_id': user_id,
            'user_role': user_role
        }, room=room_id, skip_sid=request.sid)
        
        # Send success to the user
        emit('room_joined', {
            'room_id': room_id,
            'status': 'joined'
        })
        
    except Exception as e:
        logger.error(f"Error joining room: {str(e)}")
        emit('room_error', {'error': str(e)})

@socketio.on('leave_room')
def handle_leave_room(data):
    """Leave a WebRTC room"""
    try:
        # Get user info from session
        user_session = socketio.server.get_session(request.sid)
        if not user_session:
            return
        
        user_id = user_session.get('user_id')
        room_id = data.get('room_id')
        
        if not room_id:
            return
        
        # Leave the Socket.IO room
        leave_room(room_id)
        logger.info(f"User {user_id} left room: {room_id}")
        
        # Get DB instance
        from flask import current_app
        db = current_app.config['DATABASE']
        
        # Remove from WebRTC room in database
        WebRTCRoom.remove_participant(db, room_id, user_id)
        
        # Notify others in the room
        emit('user_left', {
            'user_id': user_id
        }, room=room_id)
        
    except Exception as e:
        logger.error(f"Error leaving room: {str(e)}")

@socketio.on('webrtc_signal')
def handle_webrtc_signal(data):
    """Handle WebRTC signaling messages"""
    try:
        # Get user info from session
        user_session = socketio.server.get_session(request.sid)
        if not user_session:
            emit('signal_error', {'error': 'Not authenticated'})
            return
        
        user_id = user_session.get('user_id')
        user_role = user_session.get('user_role')
        room_id = data.get('room_id')
        signal = data.get('signal')
        target_id = data.get('target_id')
        
        if not room_id or not signal:
            emit('signal_error', {'error': 'Room ID and signal are required'})
            return
        
        # Add to message history in database
        from flask import current_app
        db = current_app.config['DATABASE']
        
        signal_data = {
            'user_id': user_id,
            'user_role': user_role,
            'timestamp': time.time(),
            'signal': signal,
            'target_id': target_id
        }
        
        WebRTCRoom.add_message(db, room_id, signal_data)
        
        # Broadcast to room or target
        if target_id:
            # Find target's socket ID
            room = WebRTCRoom.find_by_room_id(db, room_id)
            if room:
                target_socket = None
                for participant in room.get('participants', []):
                    if str(participant.get('user_id')) == str(target_id):
                        target_socket = participant.get('socket_id')
                        break
                
                if target_socket:
                    emit('webrtc_signal', {
                        'from_user_id': user_id,
                        'from_user_role': user_role,
                        'signal': signal
                    }, room=target_socket)
                    return
        
        # Broadcast to all in room if no target or target not found
        emit('webrtc_signal', {
            'from_user_id': user_id,
            'from_user_role': user_role,
            'signal': signal
        }, room=room_id, skip_sid=request.sid)
        
    except Exception as e:
        logger.error(f"Error handling WebRTC signal: {str(e)}")
        emit('signal_error', {'error': str(e)})

def create_default_admin(db):
    """Create default admin user if it doesn't exist"""
    default_email = os.getenv('DEFAULT_ADMIN_EMAIL', 'subrahmanyag79@gmail.com')
    default_password = os.getenv('DEFAULT_ADMIN_PASSWORD', 'Subbu@2004')
    
    # Check if admin already exists
    existing_admin = Admin.find_by_email(db, default_email)
    
    if not existing_admin:
        # Create default admin
        admin = Admin.create(db, default_email, default_password, "Admin User")
        logger.info(f"Created default admin user: {default_email}")
    else:
        logger.info(f"Default admin user already exists: {default_email}")

# Create the application instance for gunicorn to use
# Use a try-except block to handle any initialization errors gracefully
try:
    app = create_app()
except Exception as init_error:
    import sys
    print(f"CRITICAL ERROR INITIALIZING APP: {init_error}", file=sys.stderr)
    # Create a minimal app that can at least start
    app = Flask(__name__)
    
    @app.route('/', methods=['GET', 'HEAD', 'OPTIONS'])
    def error_app():
        return jsonify({
            "status": "error",
            "message": "Application failed to initialize properly. Check logs for details.",
            "error": str(init_error)
        }), 500

if __name__ == '__main__':
    # Run the application
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Starting Flask application on {host}:{port}")
    
    # Run with socketio instead of app.run
    socketio.run(app, host=host, port=port, debug=debug) 