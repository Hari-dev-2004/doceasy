"""
MongoDB Configuration Module

This module provides a centralized configuration for MongoDB connections.
It ensures that all parts of the application use the same MongoDB connection settings.
"""

import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB Atlas Connection URI
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb+srv://subrahmanyag79:dhDShm338VxoPMUz@doceasy.kp4oh2g.mongodb.net/?retryWrites=true&w=majority&appName=doceasy')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'doceasy')

# Log connection info (with credentials masked)
if MONGODB_URI:
    masked_uri = MONGODB_URI
    if '@' in MONGODB_URI:
        parts = MONGODB_URI.split('@')
        auth_part = parts[0].split('://')
        if len(auth_part) > 1:
            masked_uri = f"{auth_part[0]}://*****:*****@{parts[1]}"
    logger.info(f"MongoDB connection URI: {masked_uri}")
    logger.info(f"MongoDB database name: {MONGODB_DB_NAME}")
else:
    logger.warning("No MongoDB URI provided in environment variables")

# Create MongoDB client with explicit connection parameters
try:
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10000,  # 10 second timeout for server selection
        connectTimeoutMS=20000,          # 20 second timeout for connection
        socketTimeoutMS=45000,           # 45 second timeout for socket operations
        maxPoolSize=100,                 # Maximum connection pool size
        retryWrites=True,                # Enable retry for write operations
        w='majority',                    # Write concern for durability
        readPreference='primaryPreferred' # Read preference
    )
    
    # Test connection
    client.admin.command('ping')
    logger.info("MongoDB connection successful")
    
    # Get database instance
    db = client[MONGODB_DB_NAME]
    
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    client = None
    db = None
except Exception as e:
    logger.error(f"Unexpected error connecting to MongoDB: {e}")
    client = None
    db = None

def get_db():
    """
    Returns the database instance.
    If the connection failed, returns None.
    """
    return db

def get_client():
    """
    Returns the MongoDB client.
    If the connection failed, returns None.
    """
    return client 