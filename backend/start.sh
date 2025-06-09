#!/bin/bash
# start.sh - Script to start the Flask application with gunicorn

# Navigate to the correct directory
cd "$(dirname "$0")"

# Export the Flask app
export FLASK_APP=app.py

# Create a Python script that exports the app instance
cat > wsgi.py << 'EOF'
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()
EOF

# Start gunicorn with the correct WSGI app
exec gunicorn wsgi:app 