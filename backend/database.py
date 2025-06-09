from pymongo import MongoClient
import os

# Get MongoDB URI from environment variable or use default
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb+srv://subrahmanyag79:dhDShm338VxoPMUz@doceasy.kp4oh2g.mongodb.net/?retryWrites=true&w=majority&appName=doceasy')

# Create MongoDB client
client = MongoClient(MONGODB_URI)

# Get database instance
db = client.get_database() 