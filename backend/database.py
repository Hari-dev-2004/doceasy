"""
Database module for DocEasy application.

This module provides access to the MongoDB database through the centralized configuration.
"""

import logging
import mongodb_config

# Set up logging
logger = logging.getLogger(__name__)

# Use the centralized MongoDB client and database
client = mongodb_config.get_client()
db = mongodb_config.get_db()

# Log connection status
if db is not None:
    logger.info("Database module initialized with MongoDB connection")
else:
    logger.error("Database module failed to initialize MongoDB connection")

def get_database():
    """
    Returns the database instance.
    """
    return db

def get_client():
    """
    Returns the MongoDB client.
    """
    return client 