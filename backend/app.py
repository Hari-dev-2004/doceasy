import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_mail import Mail
from dotenv import load_dotenv
from datetime import timedelta
import logging
from models import Admin
from routes import auth_bp, admin_bp, api_bp, doctor_bp, patient_bp, payment_bp
import time
import mongodb_config

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to load .env file, but continue if it fails
try:
    load_dotenv()
except Exception as e:
    logger.warning(f"Could not load .env file: {e}")

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
    
    # MongoDB configuration - use the centralized configuration
    db = mongodb_config.get_db()
    app.config['DATABASE'] = db
    
    if db is not None:
        logger.info("MongoDB database connection established in Flask app")
    else:
        logger.error("Failed to establish MongoDB connection in Flask app")
    
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
                'mongodb_uri': mongodb_config.MONGODB_URI[:20] + '...' if mongodb_config.MONGODB_URI else 'not set',
                'jwt_expiry_hours': int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 168))
            }), 200
        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': str(e)
            }), 503
    
    @app.route('/api/consultations/<consultation_id>', methods=['GET'])
    def get_consultation(consultation_id):
        try:
            # Get token from Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Authorization token is required'}), 401
            
            token = auth_header.split(' ')[1]
            
            # Verify JWT token and get user info
            try:
                from jwt import decode
                user_data = decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
                user_id = user_data.get('user_id')
                user_role = user_data.get('role')
            except Exception as e:
                return jsonify({'error': 'Invalid authorization token'}), 401

            # Get database instance
            db = app.config['DATABASE']
            if db is None:
                return jsonify({'error': 'Database connection not available'}), 500
            
            # Find consultation
            from bson import ObjectId
            consultation = db.consultations.find_one({'_id': ObjectId(consultation_id)})
            
            if not consultation:
                return jsonify({'error': 'Consultation not found'}), 404

            # Check if user has access to this consultation
            if user_role == 'doctor' and str(consultation['doctor_id']) != user_id:
                return jsonify({'error': 'Unauthorized access'}), 403
            elif user_role == 'patient' and str(consultation['patient_id']) != user_id:
                return jsonify({'error': 'Unauthorized access'}), 403

            # Convert ObjectId to string for JSON serialization
            consultation['_id'] = str(consultation['_id'])
            consultation['doctor_id'] = str(consultation['doctor_id'])
            consultation['patient_id'] = str(consultation['patient_id'])
            if 'appointment_id' in consultation:
                consultation['appointment_id'] = str(consultation['appointment_id'])

            return jsonify({
                'consultation': consultation
            })

        except Exception as e:
            logger.error(f"Error fetching consultation: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    return app

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
    
    # Disable automatic .env loading to avoid encoding issues
    app.run(host=host, port=port, debug=debug) 