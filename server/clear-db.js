import mongoose from 'mongoose';
import Drop from './src/models/Drop.js';
import DropFile from './src/models/DropFile.js';
import DownloadEvent from './src/models/DownloadEvent.js';

await mongoose.connect('mongodb://127.0.0.1:27017/droply');

const dropsResult = await Drop.deleteMany({});
const filesResult = await DropFile.deleteMany({});
const eventsResult = await DownloadEvent.deleteMany({});

console.log('✅ Database cleared!');
console.log(`Deleted ${dropsResult.deletedCount} drops`);
console.log(`Deleted ${filesResult.deletedCount} files`);
console.log(`Deleted ${eventsResult.deletedCount} events`);

process.exit(0);
