const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB is Connected...');
    
    // Migration: Convert numerical years to Date objects
    try {
      console.log('Starting year migration check...');
      const collection = mongoose.connection.collection('media');
      
      // Use raw collection to bypass Mongoose casting
      const countToMigrate = await collection.countDocuments({ year: { $type: 'number' } });
      console.log(`Found ${countToMigrate} records with numerical years.`);
      
      if (countToMigrate > 0) {
        const cursor = collection.find({ year: { $type: 'number' } });
        let migratedCount = 0;
        
        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          if (doc.year > 1000 && doc.year < 3000) {
            const newDate = new Date(Date.UTC(doc.year, 0, 1));
            await collection.updateOne({ _id: doc._id }, { $set: { year: newDate } });
            migratedCount++;
            if (migratedCount % 100 === 0) {
              console.log(`Migrated ${migratedCount}/${countToMigrate} records...`);
            }
          }
        }
        console.log(`Successfully migrated ${migratedCount} records to Date format.`);
      } else {
        console.log('Year migration check: No records need migration.');
      }
    } catch (migrationErr) {
      console.error('Migration error:', migrationErr);
    }
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;