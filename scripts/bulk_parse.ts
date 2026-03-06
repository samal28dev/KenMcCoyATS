import fs from 'fs';
import path from 'path';

// Manually load .env since dotenv is not installed
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
import FileStore from '../src/models/FileStore';
import Candidate from '../src/models/Candidate';
import ResumeParser from '../src/lib/resume-parser';
import { loadFileData } from '../src/lib/document-processing';
import pdfParse from 'pdf-parse';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function run() {
    await dbConnect();
    console.log('Connected to DB');

    const resumes = await FileStore.find({ fileType: 'resume' });
    console.log(`Found ${resumes.length} resumes in FileStore`);

    // Override the apiKey to bypass Groq for speed and rate-limit safety if we want pure regex,
    // but user asked for real data, Groq gives better quality. We'll use Groq with fallback.
    const parser = new ResumeParser();

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of resumes) {
        try {
            const existing = await Candidate.findOne({ resumeFile: file.filename });
            if (existing) {
                skipped++;
                continue;
            }

            console.log(`Processing ${file.filename}...`);
            const buffer = await loadFileData(file.filename);
            if (!buffer) {
                console.log(`- Buffer not found`);
                failed++;
                continue;
            }

            let text = '';
            try {
                const parsedPdf = await pdfParse(buffer);
                text = parsedPdf.text || '';
            } catch (e) {
                console.log(`- Error parsing PDF text`);
                failed++;
                continue;
            }

            if (!text.trim()) {
                console.log(`- No text extracted`);
                failed++;
                continue;
            }

            // Parsing
            const parsedData = await parser.parseResume(text, file.filename);

            await Candidate.create({
                name: [parsedData.personalInfo.firstName, parsedData.personalInfo.lastName].filter(Boolean).join(' ') || 'Unknown Candidate',
                email: parsedData.personalInfo.email || `unknown_${Date.now()}@example.com`,
                phone: parsedData.personalInfo.phone || '',
                alternativeMobile: parsedData.personalInfo.altPhone || '',
                location: parsedData.personalInfo.location || '',
                currentCompany: parsedData.currentCompany || '',
                designation: parsedData.currentRole || '',
                experience: parsedData.yearsOfExperience ? parsedData.yearsOfExperience.toString() : '',
                qualifications: parsedData.allQualifications || [],
                skills: [...(parsedData.skills.technical || []), ...(parsedData.skills.soft || [])],
                summary: parsedData.summary || '',
                ctc: parsedData.ctc || 0,
                noticePeriod: parsedData.noticePeriod || 0,
                dob: parsedData.personalInfo.dob ? new Date(parsedData.personalInfo.dob) : undefined,
                linkedin: parsedData.personalInfo.linkedin || '',
                github: parsedData.personalInfo.github || '',
                portfolio: parsedData.personalInfo.portfolio || '',
                resumeFile: file.filename,
                resumeFilename: file.originalName,
                status: 'new',
                resumeWordCount: text.split(/\s+/).length,
                resumeHash: file.hash,
            });

            processed++;
            console.log(`- Success! Created candidate.`);
            await delay(1000); // 1s delay to prevent rate limiting
        } catch (err) {
            console.error(`- Error processing ${file.filename}:`, err);
            failed++;
        }
    }

    console.log(`\nFinished! Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
    process.exit(0);
}

run().catch(console.error);
