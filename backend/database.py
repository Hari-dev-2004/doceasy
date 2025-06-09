from pymongo import MongoClient
import os
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Get MongoDB URI from environment variable or use default
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb+srv://subrahmanyag79:dhDShm338VxoPMUz@doceasy.kp4oh2g.mongodb.net/?retryWrites=true&w=majority&appName=doceasy')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'doceasy')

# Log the MongoDB URI being used (with credentials partially masked)
if MONGODB_URI:
    masked_uri = MONGODB_URI.replace('//', '//*****:****@') if '@' in MONGODB_URI else MONGODB_URI
    logger.info(f"Using MongoDB URI: {masked_uri}")
else:
    logger.warning("No MongoDB URI provided in environment variables")

# Create MongoDB client with explicit connection parameters
try:
    client = MongoClient(
        MONGODB_URI, 
        serverSelectionTimeoutMS=5000,  # 5 second timeout
        connectTimeoutMS=10000,  # 10 second timeout
        socketTimeoutMS=45000,  # 45 second timeout
        maxPoolSize=100,  # Maximum connection pool size
        retryWrites=True
    )
    
    # Test connection
    client.admin.command('ping')
    logger.info("MongoDB connection successful")
    
    # Get database instance
    db = client[MONGODB_DB_NAME]
    
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    client = None
    db = None 