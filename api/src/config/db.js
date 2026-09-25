import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/lesiondb';
  mongoose.set('strictQuery', true);

  // Mongo inside compose may still be electing when the API boots, so retry.
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('mongo connected');
      return;
    } catch (err) {
      console.warn(`mongo connect failed (${attempt}/10): ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('could not connect to mongo');
}
