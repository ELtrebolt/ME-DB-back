const mongoose = require('mongoose');
const dns = require('dns');

// Windows: Node's bundled DNS can return querySrv ECONNREFUSED for mongodb+srv while OS tools
// (e.g. Resolve-DnsName) succeed. Point this process at public resolvers for SRV lookups.
// Opt out: MONGODB_SKIP_WIN_DNS=1
if (process.platform === 'win32' && process.env.MONGODB_SKIP_WIN_DNS !== '1') {
  try {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
  } catch (_) {}
}

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB is Connected...');
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
