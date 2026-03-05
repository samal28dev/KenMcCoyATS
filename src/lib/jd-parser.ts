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
  "_thought_process": "string - FIRST, write a brief paragraph analyzing the entire document. Identify the true job title (ignoring generic template headers like 'Annexure' or 'JD Template'), understand the primary responsibilities, and note where the requirements/skills are located. This step is CRITICAL for accurate extraction.",
  "title": "string - the ACTUAL job title / position name (derived from your analysis)",
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
- REQUIREMENTS: This is CRITICAL. Extract as many specific requirements as possible. Look for sections like "Must Have", "Criteria", "Experience", "Skills", "Eligibility", or even plain bullet points.
- IMPORTANT: The "title" MUST NOT include any label like "Job Title:", "Role:", "Position:", or even just "Role " at the start. Example: instead of "Role: Web Developer", just return "Web Developer".
- If the document contains a filename hint, use it to verify the job title.
- If salary/CTC/compensation is mentioned anywhere, capture it in budget
- CRITICAL: The extracted text often has stuck words (e.g., "RoleIT", "Reports toHead", "DepartmentIT"). You MUST separate these words in your output (e.g., "Role IT", "Reports to Head").
- If a field is not found, use null for numbers, empty string for strings, or empty array as appropriate
- AVOID using section headers like "Job Purpose", "Job Description", or "Job Summary" as the job title.
- AVOID generic document headers like "Job Description Template", "Annexure I", or "Template" as the job title. Look deeper for the ACTUAL role name.
`

class JDParser {
    private openai: OpenAI | null = null

    constructor(apiKey?: string) {
        // Support Groq if provided via GROQ_API_KEY env or if the apiKey starts with gsk_
        const groqKey = process.env.GROQ_API_KEY;
        const finalKey = apiKey || groqKey;

        if (finalKey) {
            const isGroq = finalKey.startsWith('gsk_') || !!groqKey;
            this.openai = new OpenAI({
                apiKey: finalKey,
                baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
                dangerouslyAllowBrowser: false,
            })
        }
    }

    public static scrub(val: string | undefined | null): string {
        if (!val) return ''
        let cleaned = val
            .replace(/^[\s,.\-–|:•·*□]+|[\s,.\-–|:•·*□]+$/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim()

        // CamelCase Spacing Repair (The Ultimate Deep Fix)
        // Space between lowercase/digit and Uppercase (e.g., "toHead" -> "to Head", "to15" -> "to 15")
        cleaned = cleaned.replace(/([a-z\d])([A-Z])/g, '$1 $2')

        // Handle specific stuck common JD labels even if they start with Uppercase
        cleaned = cleaned.replace(/\b(Role|Department|Title|Position|Location|Reports|Stakeholders|Leads|Employment|Industry|Budget|Summary|Purpose|Qualifications|Requirements)(?=[A-Z\d])/g, '$1 ')

        return cleaned.trim()
    }

    public static stripPrefix(val: string): string {
        if (!val) return ''
        let cleaned = val.trim()

        // Fix stuck Role prefix at the very start (e.g., "RoleIT")
        cleaned = cleaned.replace(/^Role(?=[A-Z])/i, '')

        // Remove common labels at the start (case-insensitive)
        const labelPattern = /^(?:job\s*title|position|role|designation|job\s*purpose|job\s*summary|overview|about\s*the\s*role|description|role\s*summary|designation|department|reports\s*to|employment\s*type|industry|budget|qualifications|requirements|stakeholders|leads|direct\s*reports|reporting\s*to|context|level|team|about\s*us)\s*[:\-–\s]*/i
        cleaned = cleaned.replace(labelPattern, '')

        // Standalone word stripping only if followed by space
        cleaned = cleaned.replace(/^(?:role|position|title|job|department|reports\s*to|context)\s+/i, '')

        return JDParser.scrub(cleaned)
    }

    public static isInvalidTitle(val: string | undefined | null): boolean {
        const scrubbed = JDParser.scrub(val)
        if (!scrubbed || scrubbed.length < 3) return true
        const lower = scrubbed.toLowerCase()

        const headers = [
            'job purpose', 'job description', 'job summary', 'overview', 'about the role',
            'responsibilities', 'requirements', 'qualifications', 'skills', 'experience',
            'salary', 'benefits', 'location', 'company profile', 'who we are', 'apply',
            'how to apply', 'position summary', 'context', 'purpose of the job',
            'stakeholders', 'leads', 'direct reports', 'reporting to', 'internal application'
        ]

        // Titles should not be an exact header or start with a common header followed by a separator
        if (headers.some(h => lower === h || lower.startsWith(`${h}:`) || lower.startsWith(`${h} -`))) return true

        // Reject generic document templates even with weird kerning
        if (/template|templa\b|annexure|ann\s*exure|appendix|header/i.test(lower)) return true

        // Reject titles that are too long (sentences) or contain multiple commas
        if (lower.split(/\s+/).length > 8) return true
        if ((lower.match(/,/g) || []).length > 1) return true

        return false
    }

    public static isInvalidContent(val: string | undefined | null): boolean {
        // Very lenient check for content lines (requirements, skills, desc)
        if (!val) return true
        const trimmed = val.trim()
        if (trimmed.length < 2) return true

        const lower = trimmed.toLowerCase()
        // Only reject if it's EXACTLY one of these headers with nothing else
        const metaHeaders = [
            'responsibilities', 'requirements', 'qualifications', 'job description',
            'overview', 'benefits', 'other details', 'employment type', 'about us',
            'key skills', 'experience'
        ]

        // Exact match check (don't scrub first, to preserve actual content)
        if (metaHeaders.some(h => lower === h || lower === `${h}:`)) {
            return true
        }

        return false
    }

    async parseJD(jdText: string, fileName?: string): Promise<ParsedJD> {
        const basicResult = this.basicParse(jdText, fileName)
        if (!this.openai) {
            return basicResult
        }

        try {
            const isGroq = !!process.env.GROQ_API_KEY || (this.openai as any)?.apiKey?.startsWith('gsk_');
            const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

            const completion = await this.openai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: JD_PARSING_PROMPT },
                    { role: 'user', content: `FileName: ${fileName || 'unnamed'}. Parse this job description:\n\n${jdText}` },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            })

            const result = completion.choices[0]?.message?.content
            if (!result) throw new Error('No response from OpenAI')

            // Log raw response for debugging
            console.log("=== AI RAW OUTPUT ===", result)

            // Strip markdown block if AI includes it
            let cleanJson = result.trim()
            const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
            if (match && match[1]) {
                cleanJson = match[1].trim()
            } else if (cleanJson.startsWith('{') && cleanJson.endsWith('}')) {
                cleanJson = cleanJson
            } else {
                // Try to find first { and last }
                const first = cleanJson.indexOf('{')
                const last = cleanJson.lastIndexOf('}')
                if (first !== -1 && last !== -1) {
                    cleanJson = cleanJson.substring(first, last + 1)
                }
            }

            const aiResult = JSON.parse(cleanJson) as ParsedJD

            // Post-process and merge with basic safeguards
            return this.cleanAndMerge(aiResult, basicResult, fileName)
        } catch (error) {
            console.error('AI JD parsing failed, falling back to basic parser:', error)
            return basicResult
        }
    }

    private cleanAndMerge(ai: ParsedJD, basic: ParsedJD, fileName?: string): ParsedJD {
        const pickTitle = (aiVal: string | null | undefined, basicVal: string | null | undefined): string => {
            const scrubbedAi = JDParser.stripPrefix(aiVal || '')
            const scrubbedBasic = JDParser.stripPrefix(basicVal || '')
            return !JDParser.isInvalidTitle(scrubbedAi) ? scrubbedAi : (!JDParser.isInvalidTitle(scrubbedBasic) ? scrubbedBasic : '')
        }

        const scrubAndValidate = (val: string | null | undefined, isTitle: boolean = false): string => {
            const scrubbed = isTitle ? JDParser.stripPrefix(val || '') : JDParser.scrub(val)
            if (isTitle) return JDParser.isInvalidTitle(scrubbed) ? '' : scrubbed
            return JDParser.isInvalidContent(scrubbed) ? '' : scrubbed
        }

        const safeArray = (arr: any): string[] => {
            if (Array.isArray(arr)) return arr.map(String)
            if (typeof arr === 'string') {
                // Try splitting by newline or bullet if it's a giant string
                return arr.split(/\n|•|-|\*|▪|◦|→|\d+\./).map(s => s.trim()).filter(s => s.length > 5)
            }
            return []
        }

        const parseExp = (val: any): number | null => {
            if (val === null || val === undefined) return null
            if (typeof val === 'number') return val
            const parsed = parseInt(String(val).replace(/\D/g, ''))
            return isNaN(parsed) ? null : parsed
        }

        // Clean the arrays but DO NOT scrub them aggressively, as scrub removes all labels
        // and can wipe out perfectly valid single-word requirements like "IT" or "React"
        const cleanArrayStr = (s: string) => {
            if (!s) return ''
            return s.replace(/^[\s\-•*▪◦→\d.)]+/, '').trim()
        }

        const aiReqs = safeArray(ai.requirements).map(cleanArrayStr).filter(r => !JDParser.isInvalidContent(r))
        const basicReqs = safeArray(basic.requirements).map(cleanArrayStr).filter(r => !JDParser.isInvalidContent(r))
        const finalReqs = aiReqs.length > 0 ? aiReqs : basicReqs

        const aiResps = safeArray(ai.responsibilities).map(cleanArrayStr).filter(r => r.length > 5)

        // Merge responsibilities into description intelligently
        let combinedDescParts = [
            JDParser.stripPrefix(ai.description) || JDParser.stripPrefix(basic.description),
            ...aiResps
        ].filter(s => s && s.length > 5)

        let combinedDesc = combinedDescParts[0] || ''
        if (combinedDescParts.length > 1) {
            combinedDesc += '\n\nKey Responsibilities:\n• ' + combinedDescParts.slice(1).join('\n• ')
        }

        // Final scrub on combined description
        combinedDesc = JDParser.scrub(combinedDesc)

        return {
            title: pickTitle(ai.title, basic.title),
            description: combinedDesc,
            location: scrubAndValidate(ai.location) || basic.location,
            budget: JDParser.scrub(ai.budget) || basic.budget,
            minExperience: parseExp(ai.minExperience) ?? parseExp(basic.minExperience),
            maxExperience: parseExp(ai.maxExperience) ?? parseExp(basic.maxExperience),
            requirements: finalReqs,
            skills: safeArray(ai.skills).map(s => JDParser.scrub(s)).filter(s => s && s.length > 1),
            qualifications: [...new Set([...safeArray(ai.qualifications), ...safeArray(basic.qualifications)])].map(q => JDParser.scrub(q)).filter(q => q && q.length > 1),
            responsibilities: [],
            employmentType: ai.employmentType || basic.employmentType,
            industry: ai.industry || basic.industry
        }
    }

    private basicParse(text: string, fileName?: string): ParsedJD {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l)
        const textLower = text.toLowerCase()

        // ── TITLE ──
        let title = ''
        const titlePatterns = [
            /(?:job\s*title|position|role|designation)\s*[:\-–]\s*(.+)/i,
            /^(?:hiring|looking\s+for|we(?:'re|\s+are)\s+hiring)\s*[:\-–]?\s*(.+)/im,
        ]
        for (const pattern of titlePatterns) {
            const match = text.match(pattern)
            if (match && !JDParser.isInvalidTitle(JDParser.stripPrefix(match[1]))) {
                title = JDParser.stripPrefix(match[1]);
                break
            }
        }
        if (!title && lines.length > 0) {
            for (const line of lines.slice(0, 5)) {
                const stripped = JDParser.stripPrefix(line)
                if (stripped.length > 3 && stripped.length < 100 && !/^(about|company|organization|who we are)/i.test(stripped) && !JDParser.isInvalidTitle(stripped)) {
                    title = stripped
                    break
                }
            }
        }

        // Strategy 2: Filename recovery
        if ((!title || JDParser.isInvalidTitle(title)) && fileName) {
            let namePart = fileName.replace(/\.[^/.]+$/, "")
            // Strip common "JD" prefixes from filename
            namePart = namePart.replace(/^(?:jd|job[_\-\s]*description|hiring)[_\-\s]*/i, '')
            title = JDParser.stripPrefix(namePart)
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

        const requirements: string[] = []
        // Expanded section matching
        const reqSectionRegex = /(?:requirements?|must\s*have|qualifications?\s*(?:and|\&)\s*requirements?|what\s*(?:you|we)\s*(?:need|require|expect)|eligibility|criteria|competencies|experience\s*required|key\s*skills)\s*[:\-–]?\s*\n([\s\S]*?)(?=\n\s*(?:responsibilities|about|benefits|perks|how\s*to|application|salary|compensation|industry|locations?|$))/i
        const reqSectionMatch = text.match(reqSectionRegex)

        if (reqSectionMatch) {
            const reqLines = reqSectionMatch[1].split('\n')
            for (const line of reqLines) {
                const cleaned = line.replace(/^[\s\-•*▪◦→\d.)]+/, '').trim()
                if (cleaned.length > 5 && cleaned.length < 350) {
                    requirements.push(cleaned)
                }
            }
        }

        // The Ultimate Fallback: Bullet Point Harvester
        // If sections fail, we grab EVERY bullet point that isn't a header or too long
        if (requirements.length < 3) {
            const bulletLines = text.match(/^[\s]*[•\-*▪→]\s*(.+)$/gm) || []
            bulletLines.forEach(line => {
                const cleaned = line.replace(/^[\s\-•*▪→]+/, '').trim()
                // Valid requirement check (not a header, decent length)
                if (cleaned.length > 15 && cleaned.length < 400 && !JDParser.isInvalidTitle(cleaned) && !JDParser.isInvalidContent(cleaned)) {
                    if (!requirements.includes(cleaned)) requirements.push(cleaned)
                }
            })

            // If even bullets are missing, just take the longest sentences from the whole text
            if (requirements.length === 0) {
                const sentences = text.split(/\.\s+|\n+/).map(s => s.trim())
                sentences.forEach(s => {
                    if (s.length > 40 && s.length < 250 && !JDParser.isInvalidTitle(s) && !JDParser.isInvalidContent(s)) {
                        if (!requirements.includes(s) && requirements.length < 8) requirements.push(s)
                    }
                })
            }
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
            // Use the first few non-header lines as description
            description = lines.slice(0, 5)
                .filter(l => l.length > 20 && !JDParser.isInvalidTitle(l))
                .join(' ')
                .slice(0, 500)
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
