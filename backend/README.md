# DocEasy Backend

This is the Flask backend for the DocEasy medical appointment system.

## Features

- Admin authentication and authorization
- Doctor management (verification, removal)
- Patient management
- Complaint handling
- Appointment management
- Notification system
- System settings management

## Tech Stack

- **Framework**: Flask 3.0
- **Database**: MongoDB Atlas (Production), MongoDB (Development)
- **Authentication**: JWT
- **CORS**: flask-cors
- **Deployment**: Render

## Project Structure

```
backend/
├── app.py          # Main Flask application
├── models.py       # MongoDB models
├── routes.py       # API routes
├── .env           # Environment variables
├── requirements.txt # Python dependencies
├── Procfile       # Deployment process file
└── README.md      # This file
```

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- MongoDB installed and running (for local development)
- pip (Python package manager)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Make sure MongoDB is running on your system:
   ```bash
   # Default MongoDB runs on localhost:27017
   ```

6. Start the Flask application:
   ```bash
   python app.py
   ```

The backend will start running on `http://localhost:5000`

## Default Admin Credentials

The system automatically creates a default admin user with the following credentials:
- **Email**: subrahmanyag79@gmail.com
- **Password**: Subbu@2004

## Deployment on Render

### Setup Steps

1. Create a new Web Service in your Render dashboard.

2. Connect to your GitHub repository.

3. Configure the following settings:
   - **Name**: doceasy-backend (or your preferred name)
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:create_app()`

4. Add the following environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas URI (already configured in code)
   - `JWT_SECRET_KEY`: A secure random string for JWT
   - `SECRET_KEY`: A secure random string for Flask
   - `CORS_ORIGIN`: Your frontend URL (comma-separated for multiple origins)
   - `FLASK_DEBUG`: false
   - Other variables as needed from the environment variables section

5. Deploy your service.

### Important Notes for Render Deployment

- The code is already configured to use MongoDB Atlas in production
- The Procfile is included for deployment
- CORS is configured to accept your frontend domain
- gunicorn is included in requirements.txt for production serving

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login for all users

### Admin Dashboard
- `GET /api/admin/dashboard/stats` - Get dashboard statistics
- `GET /api/admin/profile` - Get admin profile

### Doctor Management
- `GET /api/admin/doctors` - Get all doctors
- `GET /api/admin/doctors/:id` - Get doctor details
- `PUT /api/admin/doctors/:id/verify` - Verify/reject doctor
- `DELETE /api/admin/doctors/:id` - Remove doctor

### Patient Management
- `GET /api/admin/patients` - Get all patients
- `GET /api/admin/patients/:id` - Get patient details
- `PUT /api/admin/patients/:id/status` - Update patient status

### Complaint Management
- `GET /api/admin/complaints` - Get all complaints
- `PUT /api/admin/complaints/:id/status` - Update complaint status

### User Management
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status

### Appointment Management
- `GET /api/admin/appointments` - Get all appointments

### Notification Management
- `GET /api/admin/notifications` - Get admin notifications
- `PUT /api/admin/notifications/:id/read` - Mark notification as read
- `PUT /api/admin/notifications/read-all` - Mark all notifications as read

### System Settings
- `GET /api/admin/settings` - Get system settings
- `PUT /api/admin/settings` - Update system settings

### Public API
- `GET /api/doctors` - Get all approved doctors

## Environment Variables

The following environment variables can be configured in the `.env` file:

- `MONGODB_URI` - MongoDB connection string (default now points to MongoDB Atlas)
- `MONGODB_DB_NAME` - Database name (default: doceasy)
- `JWT_SECRET_KEY` - Secret key for JWT tokens
- `JWT_ACCESS_TOKEN_EXPIRES` - Token expiration time in hours (default: 168)
- `FLASK_ENV` - Flask environment (development/production)
- `FLASK_DEBUG` - Debug mode (True/False)
- `SECRET_KEY` - Flask secret key
- `DEFAULT_ADMIN_EMAIL` - Default admin email
- `DEFAULT_ADMIN_PASSWORD` - Default admin password
- `CORS_ORIGIN` - Allowed CORS origin (default: http://localhost:5173)
- `PORT` - Server port (default: 5000)
- `HOST` - Server host (default: 0.0.0.0)

## Security Notes

1. Change the default JWT_SECRET_KEY and SECRET_KEY in production
2. Use strong passwords for admin accounts
3. Enable HTTPS in production
4. Restrict CORS origins in production
5. Use environment-specific .env files

## Development

To run in development mode with auto-reload:
```bash
export FLASK_ENV=development
export FLASK_DEBUG=True
python app.py
```

## Testing

You can test the API endpoints using tools like:
- Postman
- curl
- Thunder Client (VS Code extension)

Example login request:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"subrahmanyag79@gmail.com","password":"Subbu@2004"}'
``` 