import OpenAI from 'openai'

export interface ParsedResume {
  personalInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    altPhone: string
    location: string
    linkedin?: string
    github?: string
    portfolio?: string
    dob?: string
  }
  summary: string
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate: string
    description: string
    highlights: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    field: string
    startDate: string
    endDate: string
    gpa?: string
  }>
  skills: {
    technical: string[]
    soft: string[]
    languages: string[]
    certifications: string[]
  }
  projects?: Array<{
    name: string
    description: string
    technologies: string[]
    url?: string
  }>
  achievements: string[]
  keywords: string[]
  yearsOfExperience: number
  currentRole?: string
  currentCompany?: string
  qualification?: string
  allQualifications?: string[]
  ctc?: number
  noticePeriod?: number
}

const RESUME_PARSING_PROMPT = `
You are an expert resume/CV parser specialising in Indian and international resumes.
Extract EVERY piece of structured information from the provided resume text.
Return the data in the EXACT JSON format specified below. Be thorough — do NOT leave fields null/empty if the information exists anywhere in the text.

JSON Structure:
{
  "personalInfo": {
    "firstName": "string",
    "lastName": "string",
    "email": "string — must include @domain.com",
    "phone": "string — primary mobile. Include country code if present, otherwise just digits",
    "altPhone": "string — alternative/secondary number or empty",
    "location": "string — current city/location. Extract from address, header, or context",
    "linkedin": "string or null — full URL",
    "github": "string or null — full URL",
    "portfolio": "string or null — any personal website",
    "dob": "string — date of birth in YYYY-MM-DD format if found, else null"
  },
  "summary": "string — professional summary/objective if available",
  "experience": [
    {
      "company": "string — company/organization name",
      "title": "string — job title/designation",
      "startDate": "string — format YYYY-MM",
      "endDate": "string — format YYYY-MM or 'Present'",
      "description": "string — role description",
      "highlights": ["key achievements in this role"]
    }
  ],
  "education": [
    {
      "institution": "string — college/university/school name",
      "degree": "string — degree name (B.Tech, MBA, etc.)",
      "field": "string — field of study/specialization",
      "startDate": "string",
      "endDate": "string — graduation year or expected year",
      "gpa": "string or null — CGPA, percentage, or grade"
    }
  ],
  "skills": {
    "technical": ["every technical skill, tool, technology, framework, language mentioned"],
    "soft": ["soft skills mentioned"],
    "languages": ["spoken/written languages like English, Hindi, etc."],
    "certifications": ["all certifications and professional courses"]
  },
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["technologies used"],
      "url": "string or null"
    }
  ],
  "achievements": ["awards, publications, notable achievements"],
  "keywords": ["top 20 ATS-relevant keywords from this resume"],
  "yearsOfExperience": "number — total years. Calculate from work dates if not stated directly. Round to nearest 0.5",
  "currentRole": "string — MUST be filled. Current or most recent job title/designation",
  "currentCompany": "string — MUST be filled. Current or most recent employer/organization",
  "qualification": "string — highest qualification (e.g. 'B.Tech in Computer Science')",
  "allQualifications": ["ALL qualifications found, from highest to lowest, e.g. 'MBA - Finance', 'B.Com', '12th - CBSE'"],
  "ctc": "number or null — current/last CTC in INR. Convert lakhs to absolute (e.g. 12 LPA = 1200000). If in thousands, multiply appropriately",
  "noticePeriod": "number or null — in days. Convert months to days (1 month = 30 days). Immediate = 0"
}

CRITICAL INSTRUCTIONS:
1. currentRole and currentCompany MUST NOT be null if ANY work experience is mentioned. Use the most recent/current entry.
2. For experience array, list ALL positions chronologically (newest first). The entry with endDate='Present' or the latest end date is current.
3. Capture ALL qualifications — from PhD to 10th class. Include specialization/stream.
4. Phone numbers: Indian mobiles are 10 digits starting with 6/7/8/9. Look for +91 prefix.
5. DOB: Look for "DOB", "Date of Birth", "D.O.B", "Born", "Birth Date" labels. Convert to YYYY-MM-DD.
6. Location: Check header area, address section, "Current Location:" label, or city mentioned near the name.
7. Skills: Extract EVERY technical keyword — programming languages, frameworks, databases, tools, platforms, methodologies.
8. CTC: Look for "CTC", "Salary", "Compensation", "Package". Common formats: "12 LPA", "12,00,000", "12 Lakhs".
9. Notice Period: Look for "Notice Period", "Notice", "Available from". "Immediate joiner" = 0 days. "1 month" = 30 days.
10. Extract email carefully — must have @ symbol and valid domain.
`

class ResumeParser {
  private openai: OpenAI | null = null

  constructor(apiKey?: string) {
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: false,
      })
    }
  }

  async parseResume(resumeText: string): Promise<ParsedResume> {
    // Always run basic parser first as a baseline
    const basicResult = this.basicParse(resumeText)

    if (!this.openai) {
      return basicResult
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: RESUME_PARSING_PROMPT },
          { role: 'user', content: `Parse this resume:\n\n${resumeText}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      const result = completion.choices[0]?.message?.content
      if (!result) throw new Error('No response from OpenAI')
      const aiResult = JSON.parse(result) as ParsedResume

      // Merge: AI takes priority, but fill any gaps from basic parser
      return this.mergeResults(aiResult, basicResult)
    } catch (error) {
      console.error('AI parsing failed, falling back to basic parser:', error)
      return basicResult
    }
  }

  /** Merge AI result with basic parser result — AI wins, basic fills gaps */
  private mergeResults(ai: ParsedResume, basic: ParsedResume): ParsedResume {
    const pick = <T>(a: T, b: T): T => {
      if (a === null || a === undefined || a === '') return b
      if (Array.isArray(a) && a.length === 0) return b
      return a
    }

    return {
      personalInfo: {
        firstName: pick(ai.personalInfo?.firstName, basic.personalInfo.firstName),
        lastName: pick(ai.personalInfo?.lastName, basic.personalInfo.lastName),
        email: pick(ai.personalInfo?.email, basic.personalInfo.email),
        phone: pick(ai.personalInfo?.phone, basic.personalInfo.phone),
        altPhone: pick(ai.personalInfo?.altPhone, basic.personalInfo.altPhone),
        location: pick(ai.personalInfo?.location, basic.personalInfo.location),
        linkedin: pick(ai.personalInfo?.linkedin, basic.personalInfo.linkedin),
        github: pick(ai.personalInfo?.github, basic.personalInfo.github),
        portfolio: pick(ai.personalInfo?.portfolio, basic.personalInfo.portfolio),
        dob: pick(ai.personalInfo?.dob, basic.personalInfo.dob),
      },
      summary: pick(ai.summary, basic.summary),
      experience: (ai.experience?.length ? ai.experience : basic.experience),
      education: (ai.education?.length ? ai.education : basic.education),
      skills: {
        technical: [...new Set([...(ai.skills?.technical || []), ...(basic.skills?.technical || [])])],
        soft: pick(ai.skills?.soft, basic.skills.soft),
        languages: pick(ai.skills?.languages, basic.skills.languages),
        certifications: [...new Set([...(ai.skills?.certifications || []), ...(basic.skills?.certifications || [])])],
      },
      projects: pick(ai.projects, basic.projects),
      achievements: pick(ai.achievements, basic.achievements),
      keywords: pick(ai.keywords, basic.keywords),
      yearsOfExperience: ai.yearsOfExperience || basic.yearsOfExperience,
      currentRole: pick(ai.currentRole, basic.currentRole),
      currentCompany: pick(ai.currentCompany, basic.currentCompany),
      qualification: pick(ai.qualification, basic.qualification),
      allQualifications: [...new Set([...(ai.allQualifications || []), ...(basic.allQualifications || [])])],
      ctc: ai.ctc ?? basic.ctc,
      noticePeriod: ai.noticePeriod ?? basic.noticePeriod,
    }
  }

  // ────────────────────────────────────────────────────
  // BASIC (REGEX) PARSER — comprehensive fallback
  // ────────────────────────────────────────────────────
  private basicParse(text: string): ParsedResume {
    const rawLines = text.split('\n')
    const lines = rawLines.map(l => l.trim()).filter(l => l)
    const textLower = text.toLowerCase()

    // ═══════════════════════════════════════════════════
    // HELPER: Identify section boundaries
    // ═══════════════════════════════════════════════════
    const sectionHeaders: Record<string, number> = {}
    const sectionPatterns: [string, RegExp][] = [
      ['experience', /^(?:work\s*|professional\s*|employment\s*)?experience[s]?(?:\s*(?:summary|details?|history))?$/i],
      ['education', /^(?:education(?:al)?(?:\s*(?:details?|background|qualifications?))?|academic\s*(?:details?|profile|background)|qualifications?)$/i],
      ['skills', /^(?:(?:technical\s*|key\s*|core\s*|professional\s*)?skills?(?:\s*(?:&|and)\s*(?:competencies?|expertise))?|(?:areas?\s*of\s*)?expertise|competencies|technical\s*(?:proficiency|summary))$/i],
      ['projects', /^(?:projects?(?:\s*(?:details?|summary|work))?|key\s*projects?)$/i],
      ['certifications', /^(?:certifications?|licenses?(?:\s*(?:&|and)\s*certifications?)?|professional\s*(?:development|certifications?))$/i],
      ['summary', /^(?:(?:professional\s*|career\s*)?summary|(?:career\s*)?objective|profile(?:\s*summary)?|about\s*me)$/i],
      ['personal', /^(?:personal\s*(?:details?|information|profile)|(?:other\s*)?details?)$/i],
      ['achievements', /^(?:achievements?|awards?(?:\s*(?:&|and)\s*(?:achievements?|recognitions?))?|honors?|recognitions?)$/i],
      ['declaration', /^(?:declaration|disclaimer)$/i],
      ['references', /^(?:references?)$/i],
      ['languages', /^(?:(?:known\s*)?languages?)$/i],
      ['hobbies', /^(?:hobbies|interests?)$/i],
    ]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/[:\-–—]+$/, '').trim()
      if (line.length > 60 || line.length < 3) continue
      for (const [name, pat] of sectionPatterns) {
        if (pat.test(line)) {
          if (!(name in sectionHeaders)) sectionHeaders[name] = i
          break
        }
      }
    }

    /** Get text block for a section */
    const getSection = (name: string): string[] => {
      const start = sectionHeaders[name]
      if (start === undefined) return []
      const allStarts = Object.values(sectionHeaders).filter(v => v > start).sort((a, b) => a - b)
      const end = allStarts[0] ?? lines.length
      return lines.slice(start + 1, end)
    }

    // ═══════════════════════════════════════════════════
    // 1. EMAIL
    // ═══════════════════════════════════════════════════
    const allEmails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []
    // Filter out common false positives
    const validEmails = allEmails.filter(e =>
      !e.match(/\.(png|jpg|jpeg|gif|svg|pdf|doc|docx)$/i) &&
      !e.startsWith('noreply@') &&
      !e.startsWith('info@')
    )
    const email = validEmails[0] || allEmails[0] || ''

    // ═══════════════════════════════════════════════════
    // 2. PHONE NUMBERS (Indian + International)
    // ═══════════════════════════════════════════════════
    const phoneNumbers: string[] = []

    // Labeled phone numbers first (highest priority)
    const labeledPhonePatterns = [
      /(?:phone|mobile|mob|cell|contact|tel|telephone|ph)\s*(?:no\.?|number|#)?\s*[:\-–]?\s*(\+?\d[\d\s.\-()]{7,17}\d)/gi,
      /(?:alt(?:ernative|ernate)?\s*(?:phone|mobile|mob|contact|no\.?))\s*[:\-–]?\s*(\+?\d[\d\s.\-()]{7,17}\d)/gi,
    ]
    for (const pat of labeledPhonePatterns) {
      let m: RegExpExecArray | null
      while ((m = pat.exec(text)) !== null) {
        phoneNumbers.push(m[1])
      }
    }

    // Indian mobile numbers: +91-XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
    const indianPhoneRegex = /(?:(?:\+?91[\s.\-]?)|(?:0))?[6-9]\d{4}[\s.\-]?\d{5}/g
    const indianMatches = text.match(indianPhoneRegex) || []
    phoneNumbers.push(...indianMatches)

    // International format: +1-XXX-XXX-XXXX, +44 XXXX XXXXXX, etc.
    const intlPhoneRegex = /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{0,4}/g
    const intlMatches = text.match(intlPhoneRegex) || []
    phoneNumbers.push(...intlMatches)

    // Generic: any 10+ digit cluster near phone-like context
    const genericPhone = /(\d[\d\s.\-()]{8,16}\d)/g
    const nearPhoneContext = text.match(/(?:phone|mobile|mob|cell|contact|tel)[:\s\-]*(\d[\d\s.\-()]{8,16}\d)/gi) || []
    phoneNumbers.push(...nearPhoneContext.map(m => m.replace(/^[^0-9+]+/, '')))

    // Clean & dedupe phone numbers
    const cleanPhoneNumber = (p: string): string => p.replace(/[\s.\-()]/g, '')
    const uniquePhones = [...new Set(phoneNumbers.map(cleanPhoneNumber))]
      .filter(p => {
        const digitsOnly = p.replace(/\D/g, '')
        return digitsOnly.length >= 10 && digitsOnly.length <= 15
      })
      .map(p => {
        // Normalize Indian numbers
        let clean = p.replace(/^0+/, '')
        if (clean.startsWith('+91')) clean = clean.slice(3)
        else if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2)
        return clean
      })
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe again after normalization

    const phone = uniquePhones[0] || ''
    const altPhone = uniquePhones[1] || ''

    // ═══════════════════════════════════════════════════
    // 3. NAME
    // ═══════════════════════════════════════════════════
    let firstName = '', lastName = ''
    const nameStopWords = ['resume', 'curriculum', 'vitae', 'cv', 'profile', 'objective',
      'summary', 'email', 'phone', 'mobile', 'address', 'contact', 'experience',
      'education', 'skills', 'career', 'professional', 'personal', 'details',
      'name:', 'full name:', 'candidate']

    // Strategy 1: Look for explicit "Name:" label
    const nameLabel = text.match(/(?:full\s*)?name\s*[:\-–]\s*([A-Za-z\s.]+?)(?:\n|$)/i)
    if (nameLabel) {
      const parts = nameLabel[1].trim().replace(/^(mr|ms|mrs|dr|prof)\.?\s*/i, '').split(/\s+/).filter(w => w.length > 0)
      firstName = parts[0] || ''
      lastName = parts.slice(1).join(' ') || ''
    }

    // Strategy 2: First prominent line (typical resume layout — name is at the top)
    if (!firstName) {
      for (const line of rawLines.slice(0, 15)) {
        const trimmed = line.trim()
        const lineLower = trimmed.toLowerCase()
        if (trimmed.length > 60 || trimmed.length < 2) continue
        if (lineLower.includes('@') || lineLower.includes('http') || lineLower.includes('www.')) continue
        if (/^\d/.test(trimmed)) continue
        if (/^[\+\(]?\d/.test(trimmed) && /\d{4,}/.test(trimmed)) continue
        if (nameStopWords.some(w => lineLower.startsWith(w))) continue
        // Skip if it's mostly non-alpha (phone, address)
        if (trimmed.replace(/[^A-Za-z\s]/g, '').length < trimmed.length * 0.6) continue

        let cleaned = trimmed.replace(/^(mr|ms|mrs|dr|prof)\.?\s*/i, '')
        // Remove trailing pipes, dashes (from header separators)
        cleaned = cleaned.replace(/\s*[|–\-—].*$/, '').trim()

        const words = cleaned.split(/\s+/).filter(w => w.length > 0)
        // Name: 1-5 words, mostly alphabetic
        if (words.length >= 1 && words.length <= 5 && words.every(w => /^[A-Za-z.']+$/.test(w))) {
          firstName = words[0]
          lastName = words.slice(1).join(' ')
          break
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 4. DOB — Date of Birth
    // ═══════════════════════════════════════════════════
    let dob: string | undefined
    const months: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10',
      nov: '11', november: '11', dec: '12', december: '12',
    }

    const dobPatterns = [
      // "DOB: 15/03/1990" or "DOB: 03/15/1990" or "DOB: 15-03-1990"
      /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*(?:on)?)\s*[:\-–]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i,
      // "DOB: 1990-03-15"
      /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*(?:on)?)\s*[:\-–]?\s*(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/i,
      // "DOB: 15 March 1990" or "DOB: March 15, 1990" or "DOB: 15-Mar-1990"
      /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*(?:on)?)\s*[:\-–]?\s*(\d{1,2})[\s\-,]*([a-z]+)[\s\-,]*(\d{4})/i,
      /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*(?:on)?)\s*[:\-–]?\s*([a-z]+)[\s\-,]*(\d{1,2})[\s\-,]*(\d{4})/i,
      // "DOB: 15/03/90" (short year)
      /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*(?:on)?)\s*[:\-–]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/i,
    ]

    for (const pat of dobPatterns) {
      const m = text.match(pat)
      if (m) {
        let y: string, mon: string, d: string
        const p1 = m[1], p2 = m[2], p3 = m[3]

        if (/^\d{4}$/.test(p1)) {
          // YYYY-MM-DD
          y = p1; mon = p2.padStart(2, '0'); d = p3.padStart(2, '0')
        } else if (/^[a-z]/i.test(p1)) {
          // Month DD, YYYY
          mon = months[p1.toLowerCase()] || p1.padStart(2, '0')
          d = p2.padStart(2, '0'); y = p3
        } else if (/^[a-z]/i.test(p2)) {
          // DD Month YYYY
          d = p1.padStart(2, '0')
          mon = months[p2.toLowerCase()] || p2.padStart(2, '0')
          y = p3
        } else if (/^\d{2}$/.test(p3)) {
          // DD/MM/YY
          d = p1.padStart(2, '0'); mon = p2.padStart(2, '0')
          const yy = parseInt(p3)
          y = (yy > 50 ? '19' : '20') + p3
        } else {
          // DD/MM/YYYY — check if day > 12 to determine DD/MM vs MM/DD
          const n1 = parseInt(p1), n2 = parseInt(p2)
          if (n1 > 12) {
            d = p1.padStart(2, '0'); mon = p2.padStart(2, '0')
          } else if (n2 > 12) {
            mon = p1.padStart(2, '0'); d = p2.padStart(2, '0')
          } else {
            // Ambiguous — assume DD/MM (Indian format)
            d = p1.padStart(2, '0'); mon = p2.padStart(2, '0')
          }
          y = p3
        }

        if (y && mon && d) {
          const year = parseInt(y)
          const month = parseInt(mon)
          const day = parseInt(d)
          if (year >= 1950 && year <= 2010 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            dob = `${y}-${mon}-${d}`
            break
          }
        }
      }
    }

    // Personal details section fallback for DOB
    if (!dob) {
      const personalLines = getSection('personal')
      for (const line of personalLines) {
        for (const pat of dobPatterns) {
          const m = line.match(pat)
          if (m) {
            // Try the same parsing logic (simplified)
            const raw = m.slice(1).join(' ')
            if (raw) { dob = raw; break }
          }
        }
        if (dob) break
      }
    }

    // ═══════════════════════════════════════════════════
    // 5. LOCATION
    // ═══════════════════════════════════════════════════
    let location = ''
    const indianCities = [
      'Mumbai', 'Delhi', 'New Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai',
      'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Noida',
      'Gurgaon', 'Gurugram', 'Indore', 'Bhopal', 'Kochi', 'Ernakulam', 'Coimbatore',
      'Nagpur', 'Surat', 'Vadodara', 'Visakhapatnam', 'Vizag', 'Thiruvananthapuram',
      'Trivandrum', 'Patna', 'Ranchi', 'Dehradun', 'Mysore', 'Mysuru', 'Mangalore',
      'Mangaluru', 'Bhubaneswar', 'Guwahati', 'Raipur', 'Nashik', 'Thane',
      'Navi Mumbai', 'Faridabad', 'Ghaziabad', 'Greater Noida', 'Mohali', 'Panchkula',
      'Shimla', 'Jammu', 'Srinagar', 'Amritsar', 'Ludhiana', 'Agra', 'Varanasi',
      'Kanpur', 'Meerut', 'Allahabad', 'Prayagraj', 'Jodhpur', 'Udaipur', 'Kota',
      'Rajkot', 'Bhavnagar', 'Aurangabad', 'Solapur', 'Kolhapur', 'Trivandrum',
      'Thrissur', 'Calicut', 'Kozhikode', 'Madurai', 'Salem', 'Trichy', 'Tiruchirappalli',
      'Tiruppur', 'Tirunelveli', 'Hubli', 'Belgaum', 'Belagavi', 'Dharwad',
      'Vijayawada', 'Guntur', 'Tirupati', 'Warangal', 'Karimnagar',
      'Burdwan', 'Siliguri', 'Durgapur', 'Asansol', 'Jamshedpur', 'Dhanbad', 'Bokaro',
      'Bilaspur', 'Korba', 'Bhilai', 'Jabalpur', 'Gwalior', 'Ujjain',
      'Bareilly', 'Moradabad', 'Gorakhpur', 'Aligarh', 'Saharanpur',
    ]

    const intlCities = [
      'Dubai', 'Abu Dhabi', 'Sharjah', 'Doha', 'Riyadh', 'Jeddah', 'Muscat',
      'Singapore', 'Kuala Lumpur', 'Bangkok', 'Hong Kong', 'Tokyo', 'London',
      'Manchester', 'Birmingham', 'New York', 'San Francisco', 'Chicago', 'Dallas',
      'Houston', 'Seattle', 'Boston', 'Toronto', 'Vancouver', 'Sydney', 'Melbourne',
      'Berlin', 'Munich', 'Frankfurt', 'Paris', 'Amsterdam', 'Dublin',
    ]

    // Labeled patterns
    const locationPatterns = [
      /(?:current\s*)?(?:location|city|current\s*city|residing\s*(?:in|at)|based\s*(?:in|at)|place)\s*[:\-–]?\s*([A-Za-z\s,]+?)(?:\n|$)/i,
      /(?:present\s*)?(?:location|address)\s*[:\-–]?\s*(?:[^,\n]*,\s*)?([A-Za-z\s]+?)(?:\s*[-–,]\s*\d|\n|$)/i,
      /(?:address)\s*[:\-–]?\s*[^\n]*?(?:,\s*)([A-Za-z\s]+?)(?:\s*[-–]\s*\d{5,6}|\s*,\s*(?:India|IN)\b|\n|$)/i,
    ]

    for (const pat of locationPatterns) {
      const m = text.match(pat)
      if (m) {
        const loc = m[1].trim().replace(/[,\s]+$/, '').replace(/\s{2,}/g, ' ')
        if (loc.length >= 2 && loc.length <= 50) { location = loc; break }
      }
    }

    // Fallback: city in header area (first 8 lines)
    if (!location) {
      const header = rawLines.slice(0, 8).join(' ')
      for (const city of [...indianCities, ...intlCities]) {
        if (new RegExp(`\\b${city.replace(/[()]/g, '\\$&')}\\b`, 'i').test(header)) {
          location = city; break
        }
      }
    }

    // Fallback: any city mention in full text
    if (!location) {
      for (const city of indianCities) {
        if (new RegExp(`\\b${city.replace(/[()]/g, '\\$&')}\\b`, 'i').test(text)) {
          location = city; break
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 6. PROFESSIONAL SUMMARY
    // ═══════════════════════════════════════════════════
    let summary = ''
    const summaryLines = getSection('summary')
    if (summaryLines.length) {
      summary = summaryLines.slice(0, 5).join(' ').trim()
    }
    // Also try inline summary (first paragraph-like block before sections)
    if (!summary) {
      const firstSectionStart = Math.min(...Object.values(sectionHeaders), lines.length)
      const headerEnd = Math.min(15, firstSectionStart)
      const candidateLines: string[] = []
      for (let i = 0; i < headerEnd; i++) {
        const l = lines[i]
        if (l.length > 50 && /[a-z]/.test(l) && !l.includes('@') && !/^\d/.test(l)) {
          candidateLines.push(l)
        }
      }
      if (candidateLines.length) summary = candidateLines.slice(0, 3).join(' ').trim()
    }

    // ═══════════════════════════════════════════════════
    // 7. EXPERIENCE ENTRIES + CURRENT COMPANY/ROLE
    // ═══════════════════════════════════════════════════
    const experienceEntries: ParsedResume['experience'] = []
    let currentCompany = ''
    let currentRole = ''

    // Role-title keywords for validation
    const roleTitleKeywords = /\b(engineer|developer|manager|analyst|consultant|lead|architect|designer|administrator|director|executive|officer|specialist|associate|intern|trainee|head|vp|svp|avp|president|coordinator|supervisor|technician|scientist|researcher|accountant|recruiter|hr\b|sde|swe|qa|tester|devops|full\s*stack|front\s*end|back\s*end|data|product|project|program|business|operations|marketing|sales|support|admin|software|senior|junior|sr\.?|jr\.?|chief|principal|staff|clerk|teacher|professor|lecturer|assistant|pilot|nurse|doctor|lawyer|advocate|ca\b|cfo|ceo|cto|coo|founder|co-founder|partner|member|fellow)\b/i

    const cleanField = (val: string) => val.replace(/^[\s,.\-–|:]+|[\s,.\-–|:]+$/g, '').replace(/\s{2,}/g, ' ').trim()

    // Date regex for identifying experience entries
    const dateRangeRegex = /(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.\s,]*\d{4}|\d{1,2}[\/\-.]\d{4}|\d{4})\s*[-–—to]+\s*(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.\s,]*\d{4}|\d{1,2}[\/\-.]\d{4}|\d{4}|present|current|till\s*date|ongoing|now)/i

    const presentRegex = /\b(?:present|current|till\s*date|ongoing|now)\b/i

    // ─── Method A: Explicit labels ────────────────────
    const desigLabel = text.match(
      /(?:current\s+)?(?:designation|position|job\s*title|role|title)\s*[:\-–]\s*(.+?)(?:\n|$)/i
    )
    if (desigLabel) currentRole = cleanField(desigLabel[1])

    const companyLabel = text.match(
      /(?:current\s+)?(?:company|employer|organization|company\s*name|firm|organisation)\s*[:\-–]\s*(.+?)(?:\n|$)/i
    )
    if (companyLabel) currentCompany = cleanField(companyLabel[1])

    // ─── Method B: Sentence-based extraction ──────────
    if (!currentCompany || !currentRole) {
      const sentencePatterns = [
        // "Currently working at COMPANY as ROLE"
        /(?:currently|presently)\s+(?:working|employed|serving|associated|engaged)\s+(?:at|with|in|for)\s+([A-Za-z0-9\s&.,()'\-]+?)(?:\s+as\s+(?:a|an)?\s*|\s*[-–,]\s*)([A-Za-z\s/.&]+?)(?:\.|,|\n|$)/i,
        // "Working as ROLE at COMPANY"
        /(?:currently\s+)?(?:working|serving|employed|engaged)\s+as\s+(?:a|an)?\s*([A-Za-z\s/.&]+?)\s+(?:at|in|with|for)\s+([A-Za-z0-9\s&.,()'\-]+?)(?:\.|,|\n|$)/i,
        // "ROLE at COMPANY since/from"
        /([A-Za-z\s/.&]+?)\s+at\s+([A-Za-z0-9\s&.,()'\-]+?)\s+(?:since|from)\s+/i,
        // "Employed with COMPANY as ROLE"
        /(?:employed|associated|engaged)\s+(?:with|at)\s+([A-Za-z0-9\s&.,()'\-]+?)\s+as\s+(?:a|an)?\s*([A-Za-z\s/.&]+?)(?:\.|,|\n|$)/i,
      ]
      for (const pat of sentencePatterns) {
        const m = text.match(pat)
        if (m) {
          // For patterns where group1=company, group2=role vs group1=role, group2=company
          const p1 = cleanField(m[1]), p2 = cleanField(m[2])
          if (pat.source.includes('as\\s+(?:a|an)') && !pat.source.startsWith('(?:currently')) {
            // "Working as ROLE at COMPANY" format
            if (!currentRole) currentRole = p1
            if (!currentCompany) currentCompany = p2
          } else if (pat.source.includes('(?:employed|associated')) {
            // "Employed with COMPANY as ROLE"
            if (!currentCompany) currentCompany = p1
            if (!currentRole) currentRole = p2
          } else {
            if (!currentCompany) currentCompany = p1
            if (!currentRole) currentRole = p2
          }
          break
        }
      }
    }

    // "ROLE at COMPANY" (standalone, e.g., in header: "Software Engineer at TCS")
    if (!currentCompany || !currentRole) {
      for (const line of lines.slice(0, 10)) {
        const m = line.match(/^([A-Za-z\s/.&]+?)\s+at\s+([A-Za-z0-9\s&.,()'\-]+?)$/i)
        if (m && roleTitleKeywords.test(m[1])) {
          if (!currentRole) currentRole = cleanField(m[1])
          if (!currentCompany) currentCompany = cleanField(m[2])
          break
        }
      }
    }

    // ─── Method C: Experience section parsing ─────────
    const expLines = getSection('experience')
    if (expLines.length) {
      let i = 0
      while (i < expLines.length) {
        const line = expLines[i]

        // Try to find a date range on this line or nearby lines
        let entryCompany = '', entryTitle = '', entryStart = '', entryEnd = ''
        let entryDesc: string[] = []

        // Check if current line has a date range
        const dateMatch = line.match(dateRangeRegex)

        if (dateMatch || (i + 1 < expLines.length && expLines[i + 1].match(dateRangeRegex))) {
          // Found an experience entry
          const dateOnLine = dateMatch ? i : i + 1
          const contextBefore = dateOnLine === i ? [] : [expLines[i]]
          const dateLine = expLines[dateOnLine]

          // Extract date range
          const dr = dateLine.match(dateRangeRegex)
          if (dr) {
            const parts = dr[0].split(/\s*[-–—]\s*|\s+to\s+/i)
            entryStart = parts[0]?.trim() || ''
            entryEnd = parts[1]?.trim() || ''
          }

          // Strip date from line to get company/role info
          const lineWithoutDate = dateLine.replace(dateRangeRegex, '').trim()
          const allContextParts = [...contextBefore, lineWithoutDate].filter(s => s.length > 1)

          // Identify company vs role from context
          for (const part of allContextParts) {
            // Split by separators
            const segments = part.split(/\s*[|–\-—,]\s*/).map(s => s.trim()).filter(s => s.length > 1)
            for (const seg of segments) {
              if (!entryTitle && roleTitleKeywords.test(seg)) {
                entryTitle = cleanField(seg)
              } else if (!entryCompany && !roleTitleKeywords.test(seg) && /[A-Z]/.test(seg)) {
                entryCompany = cleanField(seg)
              }
            }
            // If whole part looks like a role or company
            if (!entryTitle && !entryCompany) {
              if (roleTitleKeywords.test(part)) entryTitle = cleanField(part)
              else if (/[A-Z]/.test(part) && part.length < 60) entryCompany = cleanField(part)
            }
          }

          // Collect description lines until next entry or section
          let j = dateOnLine + 1
          while (j < expLines.length) {
            if (expLines[j].match(dateRangeRegex)) break
            // Check if next line looks like a new company/role header
            if (j > dateOnLine + 1 && /^[A-Z][A-Za-z\s&.,()'\-]+$/.test(expLines[j]) && expLines[j].length < 60) {
              // Could be next company name
              if (j + 1 < expLines.length && (expLines[j + 1].match(dateRangeRegex) || roleTitleKeywords.test(expLines[j + 1]))) {
                break
              }
            }
            entryDesc.push(expLines[j])
            j++
          }

          // If we didn't find title/company from context, try description
          if (!entryTitle) {
            for (const dl of entryDesc.slice(0, 2)) {
              if (roleTitleKeywords.test(dl) && dl.length < 60) {
                entryTitle = cleanField(dl)
                break
              }
            }
          }

          if (entryCompany || entryTitle) {
            experienceEntries.push({
              company: entryCompany,
              title: entryTitle,
              startDate: entryStart,
              endDate: entryEnd,
              description: entryDesc.join(' ').substring(0, 500),
              highlights: [],
            })
          }

          i = j
          continue
        }
        i++
      }

      // Set current company/role from experience entries
      if (!currentCompany || !currentRole) {
        // Prefer "Present"/"Current" entry
        const currentEntry = experienceEntries.find(e => presentRegex.test(e.endDate)) || experienceEntries[0]
        if (currentEntry) {
          if (!currentRole && currentEntry.title) currentRole = currentEntry.title
          if (!currentCompany && currentEntry.company) currentCompany = currentEntry.company
        }
      }
    }

    // ─── Method D: "Present"/"Current" lines anywhere ─
    if (!currentCompany && !currentRole) {
      for (const line of lines) {
        if (!presentRegex.test(line)) continue
        // Strip date portion
        const stripped = line.replace(/\s*[\(\[]?\s*(?:\w+\.?\s*)?(?:\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\s*[-–—]\s*(?:present|current|till\s*date|ongoing|now)\s*[\)\]]?\s*/gi, '').trim()
        if (!stripped || stripped.length < 2) continue

        const parts = stripped.split(/\s*[|–\-—,]\s*/).filter(p => p.length > 1)
        for (const p of parts) {
          const cp = cleanField(p)
          if (!currentRole && roleTitleKeywords.test(cp)) currentRole = cp
          else if (!currentCompany && /[A-Z]/.test(cp) && cp.length > 1) currentCompany = cp
        }
        if (currentCompany || currentRole) break
      }
    }

    // ═══════════════════════════════════════════════════
    // 8. QUALIFICATIONS & EDUCATION
    // ═══════════════════════════════════════════════════
    const allQualifications: string[] = []
    const educationEntries: ParsedResume['education'] = []

    // Degree patterns ordered by academic rank
    const degreeMap: [RegExp, string][] = [
      [/\b(Ph\.?D\.?|Doctorate|Doctor\s*of\s*Philosophy)\b/i, 'PhD'],
      [/\b(M\.?\s*Tech|MTech|Master\s*(?:of|in)\s*Technology)\b/i, 'M.Tech'],
      [/\b(M\.?\s*B\.?\s*A\.?|Master\s*(?:of|in)\s*Business\s*Administration)\b/i, 'MBA'],
      [/\b(M\.?\s*C\.?\s*A\.?|Master\s*(?:of|in)\s*Computer\s*Applications?)\b/i, 'MCA'],
      [/\b(M\.?\s*S\.?\s*c\.?|M\.?Sc\.?|Master\s*(?:of|in)\s*Science)\b/i, 'M.Sc'],
      [/\b(M\.?\s*E\.?|Master\s*(?:of|in)\s*Engineering)\b/i, 'M.E'],
      [/\b(M\.?\s*A\.?|Master\s*(?:of|in)\s*Arts)\b/i, 'M.A'],
      [/\b(M\.?\s*Com\.?|Master\s*(?:of|in)\s*Commerce)\b/i, 'M.Com'],
      [/\b(M\.?\s*S\.?\s*W\.?|Master\s*(?:of|in)\s*Social\s*Work)\b/i, 'MSW'],
      [/\b(M\.?\s*Phil\.?|Master\s*(?:of|in)\s*Philosophy)\b/i, 'M.Phil'],
      [/\b(M\.?\s*Des\.?|Master\s*(?:of|in)\s*Design)\b/i, 'M.Des'],
      [/\b(L\.?L\.?\s*M\.?|Master\s*(?:of|in)\s*Laws?)\b/i, 'LLM'],
      [/\b(B\.?\s*Tech|BTech|Bachelor\s*(?:of|in)\s*Technology)\b/i, 'B.Tech'],
      [/\b(B\.?\s*E\.?\b|Bachelor\s*(?:of|in)\s*Engineering)\b/i, 'B.E'],
      [/\b(B\.?\s*C\.?\s*A\.?|Bachelor\s*(?:of|in)\s*Computer\s*Applications?)\b/i, 'BCA'],
      [/\b(B\.?\s*B\.?\s*A\.?|Bachelor\s*(?:of|in)\s*Business\s*Administration)\b/i, 'BBA'],
      [/\b(B\.?\s*S\.?\s*c\.?|B\.?Sc\.?|Bachelor\s*(?:of|in)\s*Science)\b/i, 'B.Sc'],
      [/\b(B\.?\s*Com\.?|Bachelor\s*(?:of|in)\s*Commerce)\b/i, 'B.Com'],
      [/\b(B\.?\s*A\.?\b|Bachelor\s*(?:of|in)\s*Arts)\b/i, 'B.A'],
      [/\b(B\.?\s*Des\.?|Bachelor\s*(?:of|in)\s*Design)\b/i, 'B.Des'],
      [/\b(L\.?L\.?\s*B\.?|Bachelor\s*(?:of|in)\s*Laws?)\b/i, 'LLB'],
      [/\b(B\.?Pharm\.?|Bachelor\s*(?:of|in)\s*Pharmacy)\b/i, 'B.Pharm'],
      [/\b(MBBS)\b/i, 'MBBS'],
      [/\b(BDS)\b/i, 'BDS'],
      [/\b(BAMS)\b/i, 'BAMS'],
      [/\b(B\.?\s*Arch\.?|Bachelor\s*(?:of|in)\s*Architecture)\b/i, 'B.Arch'],
      [/\b(PGDM|Post\s*Graduate\s*Diploma\s*(?:in\s*Management)?)\b/i, 'PGDM'],
      [/\b(PG\s*Diploma|Post\s*Graduate?\s*Diploma)\b/i, 'PG Diploma'],
      [/\b(Diploma\s*(?:in\s*[A-Za-z\s]+)?)\b/i, 'Diploma'],
      [/\b(12th|XII(?:th)?|HSC|Higher\s*Secondary|Intermediate|\+2|Plus\s*Two|Senior\s*Secondary)\b/i, '12th'],
      [/\b(10th|X(?:th)?|SSC|Secondary\s*(?:School)?|Matriculation|SSLC)\b/i, '10th'],
      [/\b(ITI)\b/i, 'ITI'],
      [/\b(CA\b|Chartered\s*Accountant)\b/i, 'CA'],
      [/\b(CS\b|Company\s*Secretary)\b/i, 'CS'],
      [/\b(CMA\b|Cost\s*(?:and\s*)?Management\s*Accountant|ICWA)\b/i, 'CMA'],
    ]

    let highestQualification = ''

    // Scan entire text for all degrees
    for (const [pat, label] of degreeMap) {
      if (pat.test(text)) {
        if (!highestQualification) highestQualification = label

        // Try to find specialization near the degree mention
        const m = text.match(new RegExp(pat.source + '\\s*(?:[-–—,]|\\s+in\\s+|\\s+of\\s+|\\s*\\()?\\s*([A-Za-z\\s&.,/]+?)(?:\\)|\\n|,|\\d|$)', 'i'))
        const spec = m?.[2]?.trim()
        const fullQual = spec && spec.length > 2 && spec.length < 50 && !/\d{4}/.test(spec)
          ? `${label} - ${spec.replace(/[,.\s]+$/, '')}`
          : label
        if (!allQualifications.includes(fullQual) && !allQualifications.some(q => q.startsWith(label))) {
          allQualifications.push(fullQual)
        }
      }
    }

    // Parse education section for structured entries
    const eduLines = getSection('education')
    if (eduLines.length) {
      let currentEdu: Partial<ParsedResume['education'][0]> = {}
      for (const line of eduLines) {
        // Check for degree on this line
        let foundDegree = ''
        for (const [pat, label] of degreeMap) {
          if (pat.test(line)) { foundDegree = label; break }
        }

        if (foundDegree) {
          // Save previous entry
          if (currentEdu.degree) {
            educationEntries.push({
              institution: currentEdu.institution || '',
              degree: currentEdu.degree || '',
              field: currentEdu.field || '',
              startDate: currentEdu.startDate || '',
              endDate: currentEdu.endDate || '',
              gpa: currentEdu.gpa,
            })
          }
          currentEdu = { degree: foundDegree }

          // Extract year
          const yearMatch = line.match(/\b(19|20)\d{2}\b/g)
          if (yearMatch) {
            currentEdu.endDate = yearMatch[yearMatch.length - 1]
            if (yearMatch.length > 1) currentEdu.startDate = yearMatch[0]
          }

          // Extract field
          const fieldMatch = line.match(new RegExp(foundDegree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:[-–—(,]|\\s+in\\s+|\\s+of\\s+)\\s*([A-Za-z\\s&/]+)', 'i'))
          if (fieldMatch) currentEdu.field = fieldMatch[1].trim().replace(/[,.\s]+$/, '')

          // Extract GPA/percentage
          const gpaMatch = line.match(/(?:cgpa|gpa|grade|percentage|%|marks)\s*[:\-–]?\s*([\d.]+(?:\s*\/\s*[\d.]+)?(?:\s*%)?)/i)
          if (gpaMatch) currentEdu.gpa = gpaMatch[1].trim()
        } else if (currentEdu.degree) {
          // This might be institution name or additional info
          if (!currentEdu.institution && line.length > 3 && line.length < 80 && /[A-Z]/.test(line)) {
            currentEdu.institution = cleanField(line.replace(/\b(19|20)\d{2}\b/g, '').replace(/[-–—]/g, ''))
          }
          const yearMatch = line.match(/\b(19|20)\d{2}\b/g)
          if (yearMatch && !currentEdu.endDate) {
            currentEdu.endDate = yearMatch[yearMatch.length - 1]
          }
          const gpaMatch = line.match(/(?:cgpa|gpa|grade|percentage|%|marks)\s*[:\-–]?\s*([\d.]+(?:\s*\/\s*[\d.]+)?(?:\s*%)?)/i)
          if (gpaMatch && !currentEdu.gpa) currentEdu.gpa = gpaMatch[1].trim()
        }
      }
      // Push last entry
      if (currentEdu.degree) {
        educationEntries.push({
          institution: currentEdu.institution || '',
          degree: currentEdu.degree || '',
          field: currentEdu.field || '',
          startDate: currentEdu.startDate || '',
          endDate: currentEdu.endDate || '',
          gpa: currentEdu.gpa,
        })
      }
    }

    // ═══════════════════════════════════════════════════
    // 9. EXPERIENCE IN YEARS
    // ═══════════════════════════════════════════════════
    let yearsOfExperience = 0

    // Direct mention patterns
    const expYearPatterns = [
      /(\d+\.?\d*)\+?\s*(?:years?|yrs?)[\s.]*(?:of\s*)?(?:experience|exp\.?|work|in)/i,
      /(?:experience|exp\.?)\s*[:\-–]?\s*(\d+\.?\d*)\+?\s*(?:years?|yrs?)/i,
      /(?:total|overall|cumulative)\s*(?:(?:work|professional|it|industry)\s*)?(?:experience|exp\.?)\s*[:\-–]?\s*(\d+\.?\d*)\+?\s*(?:years?|yrs?)/i,
      /(\d+\.?\d*)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:total|overall|cumulative|progressive)?\s*(?:in|of)\s*(?:IT|software|industry|work)/i,
      /(?:having|with|possess)\s+(\d+\.?\d*)\+?\s*(?:years?|yrs?)/i,
      /(?:experience)\s*[:\-–]?\s*(?:around|approximately|about|over|more\s*than)?\s*(\d+\.?\d*)\+?\s*(?:years?|yrs?)/i,
    ]
    for (const pat of expYearPatterns) {
      const m = text.match(pat)
      if (m) { yearsOfExperience = parseFloat(m[1]); break }
    }

    // Calculate from experience entries if not found
    if (!yearsOfExperience && experienceEntries.length) {
      let totalMonths = 0
      for (const entry of experienceEntries) {
        const start = this.parseDateToMonths(entry.startDate)
        const end = presentRegex.test(entry.endDate)
          ? new Date().getFullYear() * 12 + new Date().getMonth()
          : this.parseDateToMonths(entry.endDate)
        if (start && end && end > start) {
          totalMonths += (end - start)
        }
      }
      if (totalMonths > 0) {
        yearsOfExperience = Math.round((totalMonths / 12) * 2) / 2 // Round to 0.5
      }
    }

    // ═══════════════════════════════════════════════════
    // 10. SKILLS (comprehensive)
    // ═══════════════════════════════════════════════════
    const skills: string[] = []

    // Technical skills - massive keyword list
    const skillKeywords: [string, RegExp][] = [
      // Programming Languages
      ['JavaScript', /\bjavascript\b/i], ['TypeScript', /\btypescript\b/i], ['Python', /\bpython\b/i],
      ['Java', /\bjava\b(?!script)/i], ['C++', /\bc\+\+\b/i], ['C#', /\bc#|c\s*sharp\b/i],
      ['C', /\bc\b(?!\+|#|s\b)/i], ['Go', /\b(?:go(?:lang)?)\b/i], ['Rust', /\brust\b/i],
      ['Ruby', /\bruby\b/i], ['PHP', /\bphp\b/i], ['Kotlin', /\bkotlin\b/i], ['Swift', /\bswift\b/i],
      ['Scala', /\bscala\b/i], ['Perl', /\bperl\b/i], ['R', /\bR\b/], ['Dart', /\bdart\b/i],
      ['Lua', /\blua\b/i], ['Haskell', /\bhaskell\b/i], ['Elixir', /\belixir\b/i],
      ['MATLAB', /\bmatlab\b/i], ['VBA', /\bvba\b/i], ['Shell', /\b(?:shell|bash|zsh)\b/i],
      ['PowerShell', /\bpowershell\b/i], ['Groovy', /\bgroovy\b/i], ['Objective-C', /\bobjective[\s-]?c\b/i],
      ['Assembly', /\bassembly\b/i], ['COBOL', /\bcobol\b/i], ['Fortran', /\bfortran\b/i],
      ['Visual Basic', /\bvisual\s*basic|vb\.?net\b/i], ['F#', /\bf#\b/i], ['Clojure', /\bclojure\b/i],
      ['Solidity', /\bsolidity\b/i],

      // Frontend
      ['React', /\breact(?:\.?js)?\b/i], ['Angular', /\bangular(?:\.?js)?\b/i], ['Vue.js', /\bvue(?:\.?js)?\b/i],
      ['Next.js', /\bnext\.?js\b/i], ['Nuxt.js', /\bnuxt\.?js\b/i], ['Svelte', /\bsvelte\b/i],
      ['HTML', /\bhtml5?\b/i], ['CSS', /\bcss3?\b/i], ['SASS/SCSS', /\bsass|scss\b/i],
      ['LESS', /\bless\b/i], ['Tailwind CSS', /\btailwind(?:\s*css)?\b/i], ['Bootstrap', /\bbootstrap\b/i],
      ['jQuery', /\bjquery\b/i], ['Redux', /\bredux\b/i], ['Zustand', /\bzustand\b/i],
      ['Material UI', /\bmaterial[\s-]?ui|mui\b/i], ['Chakra UI', /\bchakra\b/i],
      ['Ant Design', /\bant\s*design|antd\b/i], ['Styled Components', /\bstyled[\s-]?components\b/i],
      ['Storybook', /\bstorybook\b/i], ['Three.js', /\bthree\.?js\b/i], ['D3.js', /\bd3\.?js\b/i],
      ['Gatsby', /\bgatsby\b/i], ['Remix', /\bremix\b/i], ['Astro', /\bastro\b/i],
      ['Web Components', /\bweb\s*components\b/i], ['PWA', /\bpwa\b/i],
      ['WebSocket', /\bwebsocket\b/i], ['GraphQL', /\bgraphql\b/i], ['REST', /\brest(?:ful)?\s*api\b/i],
      ['Webpack', /\bwebpack\b/i], ['Vite', /\bvite\b/i], ['Babel', /\bbabel\b/i],
      ['ESLint', /\beslint\b/i], ['Prettier', /\bprettier\b/i],

      // Backend
      ['Node.js', /\bnode\.?js\b/i], ['Express', /\bexpress(?:\.?js)?\b/i], ['NestJS', /\bnestjs\b/i],
      ['Django', /\bdjango\b/i], ['Flask', /\bflask\b/i], ['FastAPI', /\bfastapi\b/i],
      ['Spring Boot', /\bspring\s*boot\b/i], ['Spring', /\bspring\s*(?:framework|mvc)?\b/i],
      ['ASP.NET', /\basp\.?net\b/i], ['.NET', /\b\.?net(?:\s*(?:core|framework))?\b/i],
      ['Rails', /\bruby\s*on\s*rails|rails\b/i], ['Laravel', /\blaravel\b/i], ['Symfony', /\bsymfony\b/i],
      ['Gin', /\bgin\b/i], ['Fiber', /\bfiber\b/i], ['Echo', /\becho\b/i],
      ['GraphQL', /\bgraphql\b/i], ['gRPC', /\bgrpc\b/i], ['REST API', /\brest\s*api\b/i],
      ['Microservices', /\bmicroservices?\b/i], ['Serverless', /\bserverless\b/i],
      ['WebSocket', /\bwebsocket\b/i], ['Socket.io', /\bsocket\.?io\b/i],

      // Database
      ['SQL', /\bsql\b/i], ['MySQL', /\bmysql\b/i], ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
      ['MongoDB', /\bmongodb\b/i], ['Redis', /\bredis\b/i], ['Oracle', /\boracle\s*(?:db|database)?\b/i],
      ['SQL Server', /\bsql\s*server|mssql\b/i], ['Cassandra', /\bcassandra\b/i],
      ['DynamoDB', /\bdynamodb\b/i], ['Firebase', /\bfirebase\b/i], ['Supabase', /\bsupabase\b/i],
      ['Elasticsearch', /\belasticsearch\b/i], ['MariaDB', /\bmariadb\b/i], ['SQLite', /\bsqlite\b/i],
      ['CouchDB', /\bcouchdb\b/i], ['Neo4j', /\bneo4j\b/i], ['InfluxDB', /\binfluxdb\b/i],
      ['Prisma', /\bprisma\b/i], ['Sequelize', /\bsequelize\b/i], ['TypeORM', /\btypeorm\b/i],
      ['Mongoose', /\bmongoose\b/i], ['Hibernate', /\bhibernate\b/i],

      // Cloud & DevOps
      ['AWS', /\baws\b/i], ['Azure', /\bazure\b/i], ['GCP', /\bgcp|google\s*cloud\b/i],
      ['Docker', /\bdocker\b/i], ['Kubernetes', /\bkubernetes|k8s\b/i], ['Jenkins', /\bjenkins\b/i],
      ['CI/CD', /\bci\s*\/?\s*cd\b/i], ['GitHub Actions', /\bgithub\s*actions\b/i],
      ['GitLab CI', /\bgitlab\s*ci\b/i], ['CircleCI', /\bcircleci\b/i], ['Travis CI', /\btravis\s*ci\b/i],
      ['Terraform', /\bterraform\b/i], ['Ansible', /\bansible\b/i], ['Chef', /\bchef\b/i],
      ['Puppet', /\bpuppet\b/i], ['CloudFormation', /\bcloudformation\b/i],
      ['Nginx', /\bnginx\b/i], ['Apache', /\bapache\b/i], ['Linux', /\blinux\b/i],
      ['Ubuntu', /\bubuntu\b/i], ['CentOS', /\bcentos\b/i], ['Windows Server', /\bwindows\s*server\b/i],
      ['Heroku', /\bheroku\b/i], ['Vercel', /\bvercel\b/i], ['Netlify', /\bnetlify\b/i],
      ['DigitalOcean', /\bdigitalocean\b/i], ['Cloudflare', /\bcloudflare\b/i],
      ['S3', /\bs3\b/i], ['EC2', /\bec2\b/i], ['Lambda', /\blambda\b/i], ['ECS', /\becs\b/i],
      ['EKS', /\beks\b/i], ['RDS', /\brds\b/i], ['Route53', /\broute\s*53\b/i],
      ['CloudFront', /\bcloudfront\b/i], ['SQS', /\bsqs\b/i], ['SNS', /\bsns\b/i],
      ['Prometheus', /\bprometheus\b/i], ['Grafana', /\bgrafana\b/i], ['ELK', /\belk\s*stack\b/i],
      ['Datadog', /\bdatadog\b/i], ['New Relic', /\bnew\s*relic\b/i],

      // Data & AI/ML
      ['Machine Learning', /\bmachine\s*learning|ml\b/i], ['Deep Learning', /\bdeep\s*learning|dl\b/i],
      ['AI', /\bartificial\s*intelligence|ai\b/i], ['NLP', /\bnlp|natural\s*language\s*processing\b/i],
      ['Computer Vision', /\bcomputer\s*vision\b/i], ['TensorFlow', /\btensorflow\b/i],
      ['PyTorch', /\bpytorch\b/i], ['scikit-learn', /\bscikit[\s-]?learn|sklearn\b/i],
      ['Pandas', /\bpandas\b/i], ['NumPy', /\bnumpy\b/i], ['Keras', /\bkeras\b/i],
      ['OpenCV', /\bopencv\b/i], ['Jupyter', /\bjupyter\b/i], ['Tableau', /\btableau\b/i],
      ['Power BI', /\bpower\s*bi\b/i], ['Hadoop', /\bhadoop\b/i], ['Spark', /\bspark\b/i],
      ['Kafka', /\bkafka\b/i], ['Airflow', /\bairflow\b/i], ['dbt', /\bdbt\b/i],
      ['Snowflake', /\bsnowflake\b/i], ['Databricks', /\bdatabricks\b/i],
      ['ETL', /\betl\b/i], ['Data Warehouse', /\bdata\s*warehouse\b/i],
      ['Data Modeling', /\bdata\s*model(?:l?ing)?\b/i],
      ['LLM', /\bllm|large\s*language\s*model\b/i], ['GPT', /\bgpt\b/i],
      ['LangChain', /\blangchain\b/i], ['RAG', /\brag\b/i],

      // Tools & Platforms
      ['Git', /\bgit\b(?!hub|lab)/i], ['GitHub', /\bgithub\b/i], ['GitLab', /\bgitlab\b/i],
      ['Bitbucket', /\bbitbucket\b/i], ['Jira', /\bjira\b/i], ['Confluence', /\bconfluence\b/i],
      ['Slack', /\bslack\b/i], ['Figma', /\bfigma\b/i], ['Postman', /\bpostman\b/i],
      ['VS Code', /\bvs\s*code|visual\s*studio\s*code\b/i], ['IntelliJ', /\bintellij\b/i],
      ['Eclipse', /\beclipse\b/i], ['Android Studio', /\bandroid\s*studio\b/i],
      ['Xcode', /\bxcode\b/i], ['Swagger', /\bswagger|openapi\b/i],
      ['Insomnia', /\binsomnia\b/i], ['Notion', /\bnotion\b/i],
      ['Trello', /\btrello\b/i], ['Asana', /\basana\b/i],
      ['Monday.com', /\bmonday\.?com\b/i], ['ClickUp', /\bclickup\b/i],

      // Testing
      ['Selenium', /\bselenium\b/i], ['Cypress', /\bcypress\b/i], ['Jest', /\bjest\b/i],
      ['Mocha', /\bmocha\b/i], ['Chai', /\bchai\b/i], ['JUnit', /\bjunit\b/i],
      ['TestNG', /\btestng\b/i], ['Playwright', /\bplaywright\b/i], ['Puppeteer', /\bpuppeteer\b/i],
      ['Appium', /\bappium\b/i], ['Postman', /\bpostman\b/i], ['SoapUI', /\bsoapui\b/i],
      ['LoadRunner', /\bloadrunner\b/i], ['JMeter', /\bjmeter\b/i],
      ['Robot Framework', /\brobot\s*framework\b/i], ['Cucumber', /\bcucumber\b/i],
      ['TDD', /\btdd\b/i], ['BDD', /\bbdd\b/i], ['Unit Testing', /\bunit\s*test(?:ing)?\b/i],
      ['Integration Testing', /\bintegration\s*test(?:ing)?\b/i],
      ['E2E Testing', /\be2e\s*test|end[\s-]*to[\s-]*end\s*test/i],
      ['Performance Testing', /\bperformance\s*test(?:ing)?\b/i],
      ['API Testing', /\bapi\s*test(?:ing)?\b/i],
      ['Manual Testing', /\bmanual\s*test(?:ing)?\b/i], ['Automation Testing', /\bautomation\s*test(?:ing)?\b/i],

      // Mobile
      ['React Native', /\breact\s*native\b/i], ['Flutter', /\bflutter\b/i],
      ['Android', /\bandroid\b/i], ['iOS', /\bios\b/i], ['Xamarin', /\bxamarin\b/i],
      ['Ionic', /\bionic\b/i], ['SwiftUI', /\bswiftui\b/i], ['Jetpack Compose', /\bjetpack\s*compose\b/i],

      // ERP/Business
      ['SAP', /\bsap\b/i], ['SAP HANA', /\bsap\s*hana\b/i], ['SAP FICO', /\bsap\s*fico\b/i],
      ['SAP MM', /\bsap\s*mm\b/i], ['SAP SD', /\bsap\s*sd\b/i], ['SAP ABAP', /\bsap\s*abap\b/i],
      ['SAP BASIS', /\bsap\s*basis\b/i], ['Salesforce', /\bsalesforce\b/i],
      ['ServiceNow', /\bservicenow\b/i], ['Tally', /\btally\b/i], ['ERP', /\berp\b/i],
      ['CRM', /\bcrm\b/i], ['HubSpot', /\bhubspot\b/i], ['Zoho', /\bzoho\b/i],
      ['Oracle EBS', /\boracle\s*ebs\b/i], ['PeopleSoft', /\bpeoplesoft\b/i],
      ['Workday', /\bworkday\b/i], ['SharePoint', /\bsharepoint\b/i],

      // Concepts & Methodologies
      ['Agile', /\bagile\b/i], ['Scrum', /\bscrum\b/i], ['Kanban', /\bkanban\b/i],
      ['DevOps', /\bdevops\b/i], ['SDLC', /\bsdlc\b/i],
      ['OOP', /\boop|object[\s-]*oriented\b/i], ['SOLID', /\bsolid\s*principles?\b/i],
      ['Design Patterns', /\bdesign\s*patterns?\b/i], ['System Design', /\bsystem\s*design\b/i],
      ['Data Structures', /\bdata\s*structures?\b/i], ['Algorithms', /\balgorithms?\b/i],
      ['MVC', /\bmvc\b/i], ['MVVM', /\bmvvm\b/i],
      ['Clean Architecture', /\bclean\s*architecture\b/i],
      ['Domain Driven Design', /\bdomain[\s-]*driven\s*design|ddd\b/i],
      ['Event Driven', /\bevent[\s-]*driven\b/i],
      ['SOA', /\bsoa|service[\s-]oriented\s*architecture\b/i],

      // Security
      ['OAuth', /\boauth\b/i], ['JWT', /\bjwt\b/i], ['SAML', /\bsaml\b/i],
      ['SSO', /\bsso|single\s*sign[\s-]*on\b/i],
      ['OWASP', /\bowasp\b/i], ['Penetration Testing', /\bpenetration\s*test(?:ing)?\b/i],
      ['Encryption', /\bencryption\b/i], ['SSL/TLS', /\bssl|tls\b/i],
      ['Cybersecurity', /\bcyber\s*security\b/i],

      // Others
      ['Blockchain', /\bblockchain\b/i], ['Web3', /\bweb3\b/i], ['Ethereum', /\bethereum\b/i],
      ['IoT', /\biot|internet\s*of\s*things\b/i], ['Embedded Systems', /\bembedded\s*systems?\b/i],
      ['RTOS', /\brtos\b/i], ['Arduino', /\barduino\b/i], ['Raspberry Pi', /\braspberry\s*pi\b/i],
      ['RPA', /\brpa|robotic\s*process\s*automation\b/i], ['UiPath', /\buipath\b/i],
      ['Blue Prism', /\bblue\s*prism\b/i], ['Automation Anywhere', /\bautomation\s*anywhere\b/i],
      ['Excel', /\bexcel\b/i], ['Word', /\bms\s*word|microsoft\s*word\b/i],
      ['PowerPoint', /\bpowerpoint|ppt\b/i], ['MS Office', /\bms\s*office|microsoft\s*office\b/i],
      ['Google Sheets', /\bgoogle\s*sheets?\b/i],
      ['AutoCAD', /\bautocad\b/i], ['SolidWorks', /\bsolidworks\b/i],
      ['Photoshop', /\bphotoshop\b/i], ['Illustrator', /\billustrator\b/i],
    ]

    for (const [name, pat] of skillKeywords) {
      if (pat.test(text) && !skills.includes(name)) {
        skills.push(name)
      }
    }

    // Also extract from Skills section directly (picks up unlisted skills)
    const skillLines = getSection('skills')
    if (skillLines.length) {
      const skillText = skillLines.join(' ')
      // Extract comma/pipe/bullet separated items
      const items = skillText.split(/[,|•●▪▸►◆■○]\s*/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40)
      for (const item of items) {
        const clean = item.replace(/^\s*[-–—]\s*/, '').trim()
        if (clean && !skills.some(s => s.toLowerCase() === clean.toLowerCase())) {
          skills.push(clean)
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 11. LINKEDIN / GITHUB / PORTFOLIO
    // ═══════════════════════════════════════════════════
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-]+/i)
    const linkedin = linkedinMatch
      ? (linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`)
      : undefined

    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-]+/i)
    const github = githubMatch
      ? (githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`)
      : undefined

    const portfolioMatch = text.match(/(?:portfolio|website|blog)\s*[:\-–]?\s*(https?:\/\/[^\s\n]+)/i)
    const portfolio = portfolioMatch ? portfolioMatch[1] : undefined

    // ═══════════════════════════════════════════════════
    // 12. CERTIFICATIONS
    // ═══════════════════════════════════════════════════
    const certifications: string[] = []
    const certRegexes = [
      /AWS\s+(?:Certified\s+)?(?:Solutions?\s*Architect|Developer|SysOps|DevOps|Cloud\s*Practitioner|Database|Machine\s*Learning|Data\s*Analytics)[^\n,]*/gi,
      /Azure\s+(?:Certified\s+)?(?:Administrator|Developer|Solutions?\s*Architect|Data\s*Engineer|AI\s*Engineer|Security)[^\n,]*/gi,
      /Google\s+(?:Cloud\s+)?(?:Certified\s+)?(?:Professional|Associate)[^\n,]*/gi,
      /(?:PMP|Project\s+Management\s+Professional|CAPM)\b/gi,
      /(?:Certified\s+)?Scrum\s*(?:Master|Product\s*Owner)|CSM|CSPO|PSM\s*[I]+/gi,
      /ITIL\s*(?:v[34])?\s*(?:Foundation|Expert|Managing)?/gi,
      /(?:CKA|CKAD|CKS)\b|Kubernetes\s+Certified/gi,
      /Cisco\s+(?:CCNA|CCNP|CCIE)[^\n,]*/gi,
      /CompTIA\s+(?:A\+|Network\+|Security\+|Cloud\+|CySA\+|CASP\+)/gi,
      /(?:CEH|Certified\s+Ethical\s+Hacker)\b/gi,
      /(?:CISSP|Certified\s+Information\s+Systems?\s+Security)\b/gi,
      /(?:OCA|OCP|OCM)\b|Oracle\s+Certified/gi,
      /Microsoft\s+Certified[^\n,]*/gi,
      /Salesforce\s+(?:Certified\s+)?(?:Administrator|Developer|Consultant|Architect)[^\n,]*/gi,
      /SAP\s+Certified[^\n,]*/gi,
      /Six\s+Sigma\s+(?:Green|Black|Yellow)\s+Belt/gi,
      /PRINCE2\b/gi,
      /(?:ISTQB|CTFL)\b[^\n,]*/gi,
    ]
    for (const pat of certRegexes) {
      const matches = text.match(pat)
      if (matches) certifications.push(...matches.map(m => m.trim()))
    }

    // Also check certifications section
    const certLines = getSection('certifications')
    for (const line of certLines) {
      const cleaned = line.replace(/^[\s\-•●▪►◆■○]+/, '').trim()
      if (cleaned && cleaned.length > 3 && cleaned.length < 100 && !certifications.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
        certifications.push(cleaned)
      }
    }

    // ═══════════════════════════════════════════════════
    // 13. CTC (Salary)
    // ═══════════════════════════════════════════════════
    let ctc: number | undefined
    const ctcPatterns = [
      // "CTC: 12 LPA" / "12.5 lakhs per annum"
      /(?:current\s*)?(?:ctc|annual\s*ctc|last\s*ctc|present\s*ctc|salary|compensation|package|annual\s*(?:salary|compensation|package)|gross\s*salary)\s*[:\-–]?\s*(?:₹|rs\.?|inr\.?)?\s*(\d+\.?\d*)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|lacs?\s*(?:per\s*annum)?)\b/i,
      // "CTC: 12,00,000" or "CTC: ₹1200000"
      /(?:current\s*)?(?:ctc|salary|compensation|package)\s*[:\-–]?\s*(?:₹|rs\.?|inr\.?)?\s*([\d,]+)\s*(?:per\s*(?:annum|year|month))?/i,
      // "12 LPA" near salary context
      /(?:ctc|salary|compensation|remuneration|earning|pay|emoluments?)[^\n]{0,30}?(\d+\.?\d*)\s*(?:lpa|lakhs?|lacs?)/i,
      // Reverse: "12 LPA" then salary label
      /(\d+\.?\d*)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|lacs?\s*(?:per\s*annum)?)\s*[^\n]{0,15}?(?:ctc|salary|compensation|package)/i,
      // Standalone near personal details: "CTC 12 LPA"
      /\bctc\b\s*[:\-–]?\s*(?:₹|rs\.?|inr\.?)?\s*(\d+\.?\d*)\s*(?:lpa|lakhs?|lacs?|l\b)/i,
    ]
    for (const pat of ctcPatterns) {
      const m = text.match(pat)
      if (m) {
        const val = m[1].replace(/,/g, '')
        const num = parseFloat(val)
        if (num > 0 && num < 300) {
          ctc = Math.round(num * 100000)  // Lakhs to INR
        } else if (num >= 10000) {
          ctc = Math.round(num)  // Already in INR
        }
        if (ctc) break
      }
    }

    // ═══════════════════════════════════════════════════
    // 14. NOTICE PERIOD
    // ═══════════════════════════════════════════════════
    let noticePeriod: number | undefined
    const npPatterns: [RegExp, (m: RegExpMatchArray) => number][] = [
      // "Notice Period: 30 days"
      [/(?:notice\s*period|notice|available\s*(?:in|after|from))\s*[:\-–]?\s*(\d+)\s*(?:days?)\b/i, m => parseInt(m[1])],
      // "Notice Period: 2 months"
      [/(?:notice\s*period|notice|available\s*(?:in|after|from))\s*[:\-–]?\s*(\d+)\s*(?:months?)\b/i, m => parseInt(m[1]) * 30],
      // "Notice Period: 2 weeks"
      [/(?:notice\s*period|notice|available\s*(?:in|after|from))\s*[:\-–]?\s*(\d+)\s*(?:weeks?)\b/i, m => parseInt(m[1]) * 7],
      // "Notice Period: 1 Month"
      [/(?:notice\s*period)\s*[:\-–]?\s*(?:one|two|three)\s*(?:months?)/i, m => {
        const w = m[0].toLowerCase()
        return w.includes('one') ? 30 : w.includes('two') ? 60 : 90
      }],
      // "Immediate joiner"
      [/\b(?:immediate(?:ly)?\s*(?:joiner|available|join(?:ing)?|start))\b/i, () => 0],
      // "Currently serving notice" 
      [/\b(?:serving|currently\s*serving)\s*(?:notice\s*(?:period)?)/i, () => 30],
      // "Buyout possible" / "Negotiable"
      [/\b(?:buy\s*out|buyout)\s*(?:possible|available|option)\b/i, () => 0],
      // "Last working day: DATE" — implies currently serving
      [/\b(?:last\s*working\s*day|lwb|relieving\s*date)\s*[:\-–]?\s*/i, () => 15],
    ]
    for (const [pat, calc] of npPatterns) {
      const m = text.match(pat)
      if (m) { noticePeriod = calc(m); break }
    }

    // ═══════════════════════════════════════════════════
    // 15. SPOKEN LANGUAGES
    // ═══════════════════════════════════════════════════
    const spokenLanguages: string[] = []
    const langNames = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi',
      'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Sanskrit',
      'French', 'German', 'Spanish', 'Japanese', 'Chinese', 'Mandarin', 'Korean',
      'Arabic', 'Portuguese', 'Russian', 'Italian', 'Dutch', 'Malay', 'Thai',
      'Konkani', 'Sindhi', 'Kashmiri', 'Dogri', 'Bodo', 'Manipuri', 'Nepali']
    const langSection = getSection('languages')
    const langText = langSection.length ? langSection.join(' ') : text
    for (const lang of langNames) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(langText)) {
        spokenLanguages.push(lang)
      }
    }

    // ═══════════════════════════════════════════════════
    // 16. ACHIEVEMENTS
    // ═══════════════════════════════════════════════════
    const achievements: string[] = []
    const achLines = getSection('achievements')
    for (const line of achLines.slice(0, 10)) {
      const cleaned = line.replace(/^[\s\-•●▪►◆■○\d.]+/, '').trim()
      if (cleaned && cleaned.length > 5) achievements.push(cleaned)
    }

    // ═══════════════════════════════════════════════════
    // BUILD FINAL RESULT
    // ═══════════════════════════════════════════════════
    return {
      personalInfo: {
        firstName,
        lastName,
        email,
        phone,
        altPhone,
        location,
        linkedin,
        github,
        portfolio,
        dob,
      },
      summary,
      experience: experienceEntries,
      education: educationEntries,
      skills: {
        technical: skills,
        soft: [],
        languages: spokenLanguages,
        certifications: [...new Set(certifications)],
      },
      projects: [],
      achievements,
      keywords: skills.slice(0, 20),
      yearsOfExperience,
      currentRole: currentRole || undefined,
      currentCompany: currentCompany || undefined,
      qualification: highestQualification || undefined,
      allQualifications,
      ctc,
      noticePeriod,
    }
  }

  /** Convert "Jan 2020", "01/2020", "2020" etc. to total months */
  private parseDateToMonths(dateStr: string): number | null {
    if (!dateStr) return null
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
      dec: 11, december: 11,
    }

    // "Jan 2020" or "January 2020"
    const m1 = dateStr.match(/([a-z]+)\s*,?\s*(\d{4})/i)
    if (m1) {
      const mo = monthNames[m1[1].toLowerCase()]
      if (mo !== undefined) return parseInt(m1[2]) * 12 + mo
    }

    // "01/2020" or "01-2020"
    const m2 = dateStr.match(/(\d{1,2})[\/\-.](\d{4})/)
    if (m2) return parseInt(m2[2]) * 12 + parseInt(m2[1]) - 1

    // Just "2020"
    const m3 = dateStr.match(/(\d{4})/)
    if (m3) return parseInt(m3[1]) * 12 + 6 // Assume mid-year

    return null
  }
}

export default ResumeParser

// Utility function to score how well a resume matches a job
export function calculateMatchScore(resume: ParsedResume, jobRequirements: string[]): number {
  const resumeText = JSON.stringify(resume).toLowerCase()
  let matches = 0
  const totalRequirements = jobRequirements.length

  jobRequirements.forEach((requirement) => {
    if (resumeText.includes(requirement.toLowerCase())) {
      matches++
    }
  })

  return totalRequirements > 0 ? Math.round((matches / totalRequirements) * 100) : 0
}
