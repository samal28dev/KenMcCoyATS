import OpenAI from 'openai'

export interface ParsedJD {
    title: string
    description: string
    requirements: string[]
    minExperience: number | null
    maxExperience: number | null
    location: string
    budget: string
    skills: string[]
    qualifications: string[]
    responsibilities: string[]
    employmentType: string
    industry: string
}

const JD_PARSING_PROMPT = `
You are an expert job description parser. Extract structured information from the provided job description text.
Return the data in the exact JSON format specified below. Be thorough and accurate.

JSON Structure:
{
  "title": "string - the job title / position name",
  "description": "string - a concise summary of the role (2-4 sentences). Do NOT copy the entire JD here.",
  "requirements": ["array of individual requirement strings - each should be a separate requirement, e.g., '5+ years of experience in React', 'Strong communication skills', 'MBA preferred'"],
  "minExperience": "number or null - minimum years of experience required",
  "maxExperience": "number or null - maximum years of experience mentioned",
  "location": "string - job location (city/region), or 'Remote' / 'Hybrid' if applicable",
  "budget": "string - salary/compensation/CTC range if mentioned, e.g., '15-25 LPA' or '120,000 - 150,000 USD'. Empty string if not found.",
  "skills": ["array of required technical and professional skills"],
  "qualifications": ["array of educational qualifications mentioned, e.g., 'B.Tech', 'MBA', 'CA'"],
  "responsibilities": ["array of key job responsibilities"],
  "employmentType": "string - Full Time / Part Time / Contract / Internship / Not Specified",
  "industry": "string - industry or domain if mentioned, e.g., 'IT', 'Finance', 'Healthcare'"
}

Important instructions:
- Extract the exact job title as stated in the document
- Split requirements into individual, distinct items (one per array element)
- Parse experience ranges: "5-10 years" → minExperience: 5, maxExperience: 10
- Parse single experience mentions: "Minimum 5 years" → minExperience: 5, maxExperience: null
- Extract all technical skills and tools mentioned throughout the document
- Identify educational qualifications separately from other requirements
- Separate responsibilities from requirements — responsibilities describe what the person will DO, requirements describe what they must HAVE
- If salary/CTC/compensation is mentioned anywhere, capture it in budget
- If a field is not found, use null for numbers, empty string for strings, or empty array as appropriate
`

class JDParser {
    private openai: OpenAI | null = null

    constructor(apiKey?: string) {
        if (apiKey) {
            this.openai = new OpenAI({
                apiKey,
                dangerouslyAllowBrowser: false,
            })
        }
    }

    async parseJD(jdText: string): Promise<ParsedJD> {
        if (!this.openai) {
            return this.basicParse(jdText)
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: JD_PARSING_PROMPT },
                    { role: 'user', content: `Parse this job description:\n\n${jdText}` },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            })

            const result = completion.choices[0]?.message?.content
            if (!result) throw new Error('No response from OpenAI')
            return JSON.parse(result) as ParsedJD
        } catch (error) {
            console.error('AI JD parsing failed, falling back to basic parser:', error)
            return this.basicParse(jdText)
        }
    }

    private basicParse(text: string): ParsedJD {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l)
        const textLower = text.toLowerCase()

        // ── TITLE ──
        // Usually the first prominent line or after "Job Title:" / "Position:"
        let title = ''
        const titlePatterns = [
            /(?:job\s*title|position|role|designation)\s*[:\-–]\s*(.+)/i,
            /^(?:hiring|looking\s+for|we(?:'re|\s+are)\s+hiring)\s*[:\-–]?\s*(.+)/im,
        ]
        for (const pattern of titlePatterns) {
            const match = text.match(pattern)
            if (match) { title = match[1].trim(); break }
        }
        if (!title && lines.length > 0) {
            // Use the first non-empty, non-company line as a fallback
            for (const line of lines.slice(0, 5)) {
                if (line.length > 3 && line.length < 100 && !/^(about|company|organization|who we are)/i.test(line)) {
                    title = line.replace(/^[#*\-\s]+/, '').trim()
                    break
                }
            }
        }

        // ── EXPERIENCE ──
        let minExperience: number | null = null
        let maxExperience: number | null = null
        const expRangeMatch = text.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:\+?\s*)?(?:years?|yrs?)/i)
        if (expRangeMatch) {
            minExperience = parseInt(expRangeMatch[1])
            maxExperience = parseInt(expRangeMatch[2])
        } else {
            const expMinMatch = text.match(/(?:minimum|min|at\s*least|above)\s*[:\-–]?\s*(\d+)\s*(?:\+?\s*)?(?:years?|yrs?)/i)
            if (expMinMatch) minExperience = parseInt(expMinMatch[1])
            const expPlainMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i)
            if (expPlainMatch && minExperience === null) minExperience = parseInt(expPlainMatch[1])
        }

        // ── LOCATION ──
        let location = ''
        const locationMatch = text.match(/(?:location|city|office|based\s+(?:in|at)|work\s+location)\s*[:\-–]\s*(.+)/i)
        if (locationMatch) {
            location = locationMatch[1].split(/[,\n]/)[0].trim()
        }
        // Check for remote/hybrid
        if (!location) {
            if (/\bremote\b/i.test(textLower)) location = 'Remote'
            else if (/\bhybrid\b/i.test(textLower)) location = 'Hybrid'
        }

        // ── BUDGET / SALARY ──
        let budget = ''
        const salaryPatterns = [
            /(?:salary|compensation|ctc|package|budget|pay)\s*[:\-–]\s*(.+)/i,
            /(?:INR|₹|Rs\.?|USD|\$)\s*[\d,.]+\s*[-–to]+\s*(?:INR|₹|Rs\.?|USD|\$)?\s*[\d,.]+\s*(?:LPA|lacs?|lakhs?|per\s*annum|\/yr|k)?/i,
            /[\d,.]+\s*[-–]\s*[\d,.]+\s*(?:LPA|lacs?|lakhs?)/i,
        ]
        for (const pattern of salaryPatterns) {
            const match = text.match(pattern)
            if (match) {
                budget = (match[1] || match[0]).trim()
                break
            }
        }

        // ── REQUIREMENTS ──
        const requirements: string[] = []
        const reqSectionMatch = text.match(/(?:requirements?|must\s*have|qualifications?\s*(?:and|\&)\s*requirements?|what\s*(?:you|we)\s*(?:need|require|expect)|eligibility)\s*[:\-–]?\s*\n([\s\S]*?)(?=\n\s*(?:responsibilities|about|benefits|perks|how\s*to|application|salary|compensation|$))/i)
        if (reqSectionMatch) {
            const reqLines = reqSectionMatch[1].split('\n')
            for (const line of reqLines) {
                const cleaned = line.replace(/^[\s\-•*▪◦→\d.)]+/, '').trim()
                if (cleaned.length > 5 && cleaned.length < 300) {
                    requirements.push(cleaned)
                }
            }
        }
        // Fallback: grab bullet points
        if (requirements.length === 0) {
            const bulletLines = text.match(/^[\s]*[•\-*▪→]\s*(.+)$/gm) || []
            bulletLines.forEach(line => {
                const cleaned = line.replace(/^[\s\-•*▪→]+/, '').trim()
                if (cleaned.length > 10 && cleaned.length < 300) {
                    requirements.push(cleaned)
                }
            })
        }

        // ── SKILLS ──
        const skills: string[] = []
        const commonSkills = [
            'javascript', 'typescript', 'react', 'angular', 'vue', 'node', 'python', 'java', 'c#', 'c\\+\\+',
            'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'docker', 'kubernetes', 'aws', 'azure',
            'gcp', 'git', 'agile', 'scrum', 'rest', 'graphql', 'html', 'css', 'sass', 'tailwind',
            'excel', 'power\\s*bi', 'tableau', 'sap', 'salesforce', 'jira', 'confluence',
            'machine\\s*learning', 'deep\\s*learning', 'ai', 'data\\s*science', 'nlp',
            'communication', 'leadership', 'problem.solving', 'analytical', 'project\\s*management',
        ]
        for (const skill of commonSkills) {
            const regex = new RegExp(`\\b${skill}\\b`, 'i')
            if (regex.test(text)) {
                // Capitalize nicely
                const found = text.match(regex)
                if (found) skills.push(found[0])
            }
        }

        // ── QUALIFICATIONS ──
        const qualifications: string[] = []
        const qualPatterns = [
            /\b(?:B\.?Tech|B\.?E|M\.?Tech|M\.?E|B\.?Sc|M\.?Sc|BCA|MCA|B\.?Com|M\.?Com|MBA|BBA|Ph\.?D|CA|CPA|CFA|ICWA|CS)\b/gi,
            /\b(?:Bachelor|Master|Doctorate|Diploma|Graduation|Post[\s-]?Graduation)\b(?:\s+(?:in|of))?\s+[A-Za-z\s]+/gi,
        ]
        for (const pattern of qualPatterns) {
            const matches = text.match(pattern)
            if (matches) {
                matches.forEach(m => {
                    const cleaned = m.trim()
                    if (!qualifications.some(q => q.toLowerCase() === cleaned.toLowerCase())) {
                        qualifications.push(cleaned)
                    }
                })
            }
        }

        // ── DESCRIPTION ──
        let description = ''
        const descMatch = text.match(/(?:about\s+(?:the\s+)?(?:role|position|job|opportunity)|job\s*description|overview|summary)\s*[:\-–]?\s*\n?([\s\S]*?)(?=\n\s*(?:requirements?|responsibilities|qualifications?|skills|must\s*have|what\s*(?:you|we)|key\s*responsibilities|$))/i)
        if (descMatch) {
            description = descMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
        }
        if (!description && lines.length > 1) {
            // Use the first paragraph-ish text
            const paragraphs = text.split(/\n\s*\n/)
            for (const p of paragraphs.slice(0, 3)) {
                const cleaned = p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
                if (cleaned.length > 50 && cleaned.length < 500 && !/^[\-•*]/.test(cleaned)) {
                    description = cleaned
                    break
                }
            }
        }

        // ── EMPLOYMENT TYPE ──
        let employmentType = 'Not Specified'
        if (/\bfull[\s-]?time\b/i.test(textLower)) employmentType = 'Full Time'
        else if (/\bpart[\s-]?time\b/i.test(textLower)) employmentType = 'Part Time'
        else if (/\bcontract\b/i.test(textLower)) employmentType = 'Contract'
        else if (/\bintern(?:ship)?\b/i.test(textLower)) employmentType = 'Internship'

        return {
            title,
            description,
            requirements,
            minExperience,
            maxExperience,
            location,
            budget,
            skills,
            qualifications,
            responsibilities: [],
            employmentType,
            industry: '',
        }
    }
}

export default JDParser
