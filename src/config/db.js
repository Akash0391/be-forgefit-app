import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forgefit';
    
    // Ensure database name is included for Atlas connections
    if (mongoURI.includes('mongodb+srv://') && !mongoURI.match(/\/[^\/]+\?/) && !mongoURI.endsWith('/')) {
      mongoURI = mongoURI + '/forgefit';
    } else if (mongoURI.includes('mongodb+srv://') && mongoURI.endsWith('/')) {
      mongoURI = mongoURI + 'forgefit';
    }
    
    // Set connection options
    const options = {
      // Remove deprecated options for newer mongoose versions
    };

    console.log(`🔌 Attempting to connect to MongoDB...`);
    const conn = await mongoose.connect(mongoURI, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    console.log('\n💡 To fix this:');
    console.log('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('   2. Start MongoDB: sudo systemctl start mongod (Linux) or brew services start mongodb-community (Mac)');
    console.log('   3. Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas');
    console.log('   4. Add MONGODB_URI to your .env file');
    console.log('\n⚠️  Server will continue without database connection. Some features may not work.\n');
    // Don't exit - allow server to run without DB for development
  }
};

export default connectDB;

