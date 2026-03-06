import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envConfig) {
        const match = line.match(/^([^#\s][^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    }
}

import mongoose from 'mongoose';
import dbConnect from '../src/lib/db';
import Candidate from '../src/models/Candidate';

async function run() {
    await dbConnect();
    console.log('Connected to DB');

    const candidates = await Candidate.find({}).sort({ createdAt: 1 });
    console.log(`Found ${candidates.length} total candidates`);

    const seen = new Set();
    const toDelete = [];

    for (const c of candidates) {
        let name = (c.name || '').toLowerCase().trim();
        let email = (c.email || '').toLowerCase().trim();
        if (email.startsWith('unknown_')) email = '';
        let phone = (c.phone || '').trim();

        // Very basic normalization
        name = name.replace(/\s+/g, ' ');

        let key = `${name}|${email}|${phone}`;
        if (!email && !phone) {
            key = name; // fallback to name only if both are missing
        }

        if (seen.has(key) && key !== '') {
            console.log(`Duplicate found: ${c.name} (${key}) - ID: ${c._id}`);
            toDelete.push(c._id);
        } else {
            seen.add(key);
        }
    }

    console.log(`\nFound ${toDelete.length} duplicates to delete.`);

    if (toDelete.length > 0) {
        const res = await Candidate.deleteMany({ _id: { $in: toDelete } });
        console.log(`Deleted ${res.deletedCount} duplicates.`);
    }

    process.exit(0);
}

run().catch(console.error);
