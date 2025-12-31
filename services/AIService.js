const { GoogleGenerativeAI } = require("@google/generative-ai");

// Force module reload for Google AI API changes
delete require.cache[require.resolve('@google/generative-ai')];

// --- CRITICAL: JSON SCHEMAS FOR STRUCTURED OUTPUT ---

// ATS Score Schema
const atsScoreSchema = {
  type: "object",
  properties: {
    score: {
      type: "number",
      description: "ATS score between 0 and 100."
    },
    summary: {
      type: "string",
      description: "One-paragraph summary explaining the score and main factors."
    },
    keywordsMatched: {
      type: "array",
      items: { type: "string" },
      description: "List of keywords matched from the job description/target role."
    },
    keywordsMissing: {
      type: "array",
      items: { type: "string" },
      description: "List of critical keywords missing from the resume."
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "List of actionable improvement suggestions."
    },
  },
  required: ["score", "summary", "keywordsMatched", "keywordsMissing", "suggestions"],
};

// Resume Content Schema (Optimized for length - All sections optional)
const resumeContentSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Concise 2-3 sentence professional summary with key achievements OR career objective for freshers"
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          position: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          description: {
            type: "array",
            items: { type: "string" },
            maxItems: 4  // Limit to 4 bullet points max
          }
        }
      },
      maxItems: 3  // Limit to 3 experiences max
    },
    skills: {
      type: "object",
      properties: {
        technical: {
          type: "array",
          items: { type: "string" },
          maxItems: 8  // Limit skills
        },
        soft: {
          type: "array",
          items: { type: "string" },
          maxItems: 6
        },
        languages: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        },
        tools: {
          type: "array",
          items: { type: "string" },
          maxItems: 6
        }
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: {
            type: "array",
            items: { type: "string" },
            maxItems: 5
          },
          outcomes: { type: "string" },
          link: { type: "string" },
          github: { type: "string" }
        }
      },
      maxItems: 2  // Limit to 2 projects max
    },
    achievements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          date: { type: "string" }
        }
      },
      maxItems: 3  // Limit to 3 achievements max
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          gpa: { type: "string" },
          description: { type: "string" }
        }
      },
      maxItems: 2  // Limit to 2 education entries max
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      maxItems: 10  // Limit keywords
    },
    analysis: {
      type: "object",
      properties: {
        atsScore: { type: "number" },
        strengths: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        }
      }
    }
  }
  // REMOVED required array - all sections are now optional
};

// --------------------------------------------------------

/**
 * Helper function to scrub the raw AI response text to fix common JSON errors
 * before attempting to parse it. This is a crucial defense against
 * SyntaxError: Unterminated string.
 * @param {string} text - The raw text output from the Gemini API.
 * @returns {string} The cleaned text.
 */
function scrubJsonText(text) {
  // First, trim whitespace from both ends
  text = text.trim();
  
  // Remove any markdown code block markers
  text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  
  // More careful quote handling - only fix obviously broken escaped quotes
  // Don't touch properly escaped quotes in valid JSON
  if (text.includes('\\"') && !text.includes('\\\\"')) {
    // Only replace if it looks like malformed JSON (double backslashes don't exist)
    text = text.replace(/\\"/g, '"');
  }
  
  // Fix trailing commas before closing brackets/braces (common JSON error)
  text = text.replace(/,\s*([}\]])/g, '$1');
  
  // Fix missing commas between array elements or object properties
  text = text.replace(/(["}\]])\s*(["{])/g, '$1,$2');
  
  // Remove control characters that might break JSON
  text = text.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Better JSON completion logic
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  
  // Add missing closing braces
  if (openBraces > closeBraces) {
    text += '}'.repeat(openBraces - closeBraces);
  }
  
  // Add missing closing brackets
  if (openBrackets > closeBrackets) {
    text += ']'.repeat(openBrackets - closeBrackets);
  }
  
  // Fix unescaped newlines within JSON strings
  text = text.replace(/"(.*?)"\s*\n\s*"(.*?)"$/g, '"$1","$2"');
  
  // If string appears truncated inside quotes, close it
  const quoteCount = (text.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    text += '"';
  }
  
  return text;
}

class AIService {
  constructor() {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.warn('Google AI API key is not configured - AI features will be disabled');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
    
    // Circuit breaker state
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.nextTry = 0;
    this.failureThreshold = 3;
    this.resetTimeout = 60000; // 1 minute
    
    // API optimization: Add caching and rate limiting
    this.cache = new Map();
    this.lastApiCall = 0;
    this.minCallInterval = 1000; // 1 second between calls
    this.dailyCallCount = 0;
    this.dailyCallLimit = 15; // Conservative limit to stay under quota
    this.lastResetDate = new Date().toDateString();
  }
  
  isAvailable() {
    return this.genAI !== null && this.circuitState !== 'OPEN' && !this.isDailyLimitReached();
  }
  
  isDailyLimitReached() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyCallCount = 0;
      this.lastResetDate = today;
    }
    return this.dailyCallCount >= this.dailyCallLimit;
  }
  
  getCacheKey(data) {
    // Create a deterministic cache key based on input data
    const key = {
      role: data.roleApplyingFor || 'general',
      isFresher: data.isFresher || false,
      skillsCount: data.skills?.technical?.length || 0,
      experienceCount: data.experience?.length || 0,
      projectsCount: data.projects?.length || 0,
      educationField: data.education?.[0]?.field || ''
    };
    return JSON.stringify(key);
  }
  
  async withRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.minCallInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minCallInterval - timeSinceLastCall));
    }
    this.lastApiCall = Date.now();
    this.dailyCallCount++;
  }

  async withCircuitBreaker(fn) {
    if (this.circuitState === 'OPEN') {
      if (Date.now() > this.nextTry) {
        this.circuitState = 'HALF-OPEN';
        // Removed console.log to reduce noise
      } else {
        // Removed console.log to reduce noise
        throw new Error('AI service temporarily unavailable. Please try again later.');
      }
    }

    try {
      const result = await fn();
      if (this.circuitState === 'HALF-OPEN') {
        this.resetCircuit();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      
      // Check for specific AI service errors
      if (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('quota') || error.message.includes('429')) {
        // Silently handle known AI service issues without console spam
        throw error; // Re-throw to trigger local fallback
      }
      
      throw error;
    }
  }

  recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'OPEN';
      this.nextTry = Date.now() + this.resetTimeout;
      // Removed console.warn to reduce noise
    }
  }

  resetCircuit() {
    this.failureCount = 0;
    this.circuitState = 'CLOSED';
    // Removed console.log to reduce noise
  }

  async generateProfileSummary(data) {
    if (!this.isAvailable()) {
      return this.generateProfileSummaryLocally(data);
    }
    
    return this.withCircuitBreaker(async () => {
      const { roleApplyingFor, isFresher, skills, experience, education } = data;
      
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      });

      const context = {
        skills: skills?.technical?.slice(0, 5) || [],
        experienceCount: experience?.length || 0,
        education: education?.[0]?.field || 'General'
      };

      const prompt = `Generate a professional ${isFresher ? 'objective' : 'summary'} for a ${roleApplyingFor} position.

Candidate Profile:
- Role: ${roleApplyingFor}
- Experience Level: ${isFresher ? 'Fresher' : 'Experienced'}
- Skills: ${context.skills.join(', ')}
- Experience: ${context.experienceCount} positions
- Education: ${context.education}

Requirements:
- ${isFresher ? 'Focus on education, skills, and career objectives' : 'Focus on experience, achievements, and expertise'}
- Keep it concise (2-3 sentences)
- Make it compelling and professional
- Include relevant keywords for ATS
- Tailor it specifically for ${roleApplyingFor}

Generate the ${isFresher ? 'objective' : 'summary'}:`;

      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 15000)
          )
        ]);
        
        const response = await result.response;
        const summary = response.text().trim();
        
        return {
          success: true,
          summary,
          objective: isFresher ? summary : undefined
        };
      } catch (error) {
        console.error('Error generating profile summary:', error);
        return this.generateProfileSummaryLocally(data);
      }
    });
  }

  generateProfileSummaryLocally(data) {
    const { roleApplyingFor, isFresher, skills, experience, education } = data;
    
    const summary = this.generateSummary(
      { summary: null }, // Force generation
      skills,
      experience,
      isFresher,
      roleApplyingFor
    );
    
    const objective = isFresher ? this.generateObjective(
      {},
      education,
      skills,
      roleApplyingFor
    ) : undefined;
    
    return {
      success: true,
      summary,
      objective
    };
  }

  async enhanceMultipleSections(sections, context = {}) {
    if (!this.isAvailable()) {
      return this.enhanceSectionsLocally(sections, context);
    }
    
    return this.withCircuitBreaker(async () => {
      const enhancedSections = {};
      
      // Enhance projects
      if (sections.projects) {
        enhancedSections.projects = sections.projects.map(proj => ({
          ...proj,
          description: proj.description || this.enhanceProjectDescription(proj, sections.skills),
          outcomes: proj.outcomes || this.generateProjectOutcomes(proj)
        }));
      }
      
      // Enhance achievements
      if (sections.achievements) {
        enhancedSections.achievements = sections.achievements.map(ach => ({
          ...ach,
          description: ach.description || this.enhanceAchievementDescription(ach)
        }));
      }
      
      // Add course summary for education
      if (sections.education) {
        enhancedSections.courseSummary = this.generateCourseSummary(sections.education, context.roleApplyingFor);
      }
      
      return {
        success: true,
        enhancedSections
      };
    });
  }

  enhanceSectionsLocally(sections, context = {}) {
    const enhancedSections = {};
    
    // Enhance projects locally
    if (sections.projects) {
      enhancedSections.projects = sections.projects.map(proj => ({
        ...proj,
        description: proj.description || this.enhanceProjectDescription(proj, sections.skills),
        outcomes: proj.outcomes || this.generateProjectOutcomes(proj)
      }));
    }
    
    // Enhance achievements locally
    if (sections.achievements) {
      enhancedSections.achievements = sections.achievements.map(ach => ({
        ...ach,
        description: ach.description || this.enhanceAchievementDescription(ach)
      }));
    }
    
    // Add course summary for education
    if (sections.education) {
      enhancedSections.courseSummary = this.generateCourseSummary(sections.education, context.roleApplyingFor);
    }
    
    return {
      success: true,
      enhancedSections
    };
  }

  async enhanceSection(section, content, context = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'AI service is not available' };
    }
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      });

      let prompt = `Enhance the following ${section} section for a resume. 
${context.targetRole ? `Target role: ${context.targetRole}\n` : ''}
${context.jobDescription ? `Job description: ${context.jobDescription}\n` : ''}`;

      if (section === 'project') {
        prompt += `Project Name: ${context.projectName || 'N/A'}\n`;
        prompt += `Technologies: ${context.technologies || 'N/A'}\n\n`;
        prompt += `Current ${context.field}:\n${content}\n\n`;
        
        if (context.field === 'outcomes') {
          prompt = `Generate 3-5 bullet points of key achievements/outcomes for this project. Each point should start with a strong action verb and include metrics where possible. Format each point on a new line starting with "• ".

Project: ${content}

Example format:
• Increased user engagement by 40% through implementation of new features
• Reduced page load time by 2.5 seconds, improving user experience
• Led a team of 5 developers to deliver the project 2 weeks ahead of schedule

Key achievements/outcomes:`;
        } else {
          prompt = `Enhance the project description to be more compelling and achievement-focused. Include specific details about your role, technologies used, and impact. Format in 2-3 clear, concise sentences.

Current description: ${content}

Enhanced description:`;
        }
      } else if (section === 'achievement') {
        prompt += `Achievement Title: ${context.achievementTitle || 'N/A'}\n`;
        prompt += `Date: ${context.date || 'N/A'}\n\n`;
        prompt += `Current ${context.field}:\n${content}\n\n`;
        
        prompt = `Generate 2-3 bullet points describing this achievement in more detail. Each point should start with a strong action verb and include metrics where possible. Format each point on a new line starting with "• ".

Achievement: ${content}

Example format:
• Recognized as "Employee of the Year" among 500+ employees
• Achieved 98% customer satisfaction rating, 15% above company average
• Successfully led a team that increased sales by 35% YoY

Achievement details:`;
      }

      let result;
      let retryCount = 0;
      const maxRetries = 3;
      let retryDelay = 1000; // 1 second
      
      while (retryCount < maxRetries) {
        try {
          result = await model.generateContent(prompt);
          break; // Success, exit retry loop
        } catch (error) {
          if (error.status === 503 && retryCount < maxRetries - 1) {
            console.log(`AI service overloaded, retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
            retryDelay *= 2; // Exponential backoff
          } else {
            throw error;
          }
        }
      }
      const response = await result.response;
      const enhancedContent = response.text().trim();
      
      // Ensure bullet points are properly formatted
      const formattedContent = enhancedContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => line.startsWith('•') ? line : `• ${line}`)
        .join('\n');
      
      return { success: true, enhancedContent: formattedContent };
    } catch (error) {
      console.error(`Error enhancing ${section} section:`, error);
      return { success: false, error: `Failed to enhance ${section} section. Please try again later.` };
    }
  }

  async generateResumeContent(data) {
    // Check cache first
    const cacheKey = this.getCacheKey(data);
    if (this.cache.has(cacheKey)) {
      console.log('Using cached resume enhancement');
      return this.cache.get(cacheKey);
    }
    
    // Always try AI first, but immediately fallback to local if any issues
    try {
      if (this.isAvailable() && this.circuitState !== 'OPEN') {
        const result = await this.withCircuitBreaker(async () => {
          await this.withRateLimit(); // Add rate limiting
          return await this.generateResumeContentWithAI(data);
        });
        
        // Cache successful results
        this.cache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      // Silently handle AI failures without console spam
    }
    
    // Always fall back to local enhancement
    const localResult = this.enhanceContentLocally(data);
    this.cache.set(cacheKey, localResult); // Cache local results too
    return localResult;
  }

  async generateResumeContentWithAI(data) {
    const { personalInfo, skills, education, experience, projects, achievements, certifications, roleApplyingFor, aiPrompt, isFresher, template, jobDescription } = data;
    const effectiveRole = roleApplyingFor || 'Professional';
    
    // Build context from existing data
    const context = [];
    
    if (personalInfo.summary) {
      context.push(`Professional Summary: ${personalInfo.summary}`);
    }
    
    if (education && education.length > 0) {
      context.push('Education:');
      education.forEach(edu => {
        context.push(`- ${edu.degree} in ${edu.field} from ${edu.institution}`);
      });
    }
    
    if (experience && experience.length > 0) {
      context.push('Work Experience:');
      experience.forEach(exp => {
        context.push(`- ${exp.position} at ${exp.company}`);
        if (exp.description) {
          context.push(`  ${Array.isArray(exp.description) ? exp.description.join(' ') : exp.description}`);
        }
      });
    }
    
    if (skills && skills.technical?.length > 0) {
      context.push(`Technical Skills: ${skills.technical.join(', ')}`);
    }

    const resumeContentSchema = {
      type: "object",
      properties: {
        personalInfo: {
          type: "object",
          properties: {
            summary: { type: "string" },
            objective: { type: "string" }
          },
          required: ["summary"]
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              institution: { type: "string" },
              degree: { type: "string" },
              field: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              gpa: { type: "string" },
              achievements: { type: "array", items: { type: "string" } }
            },
            required: ["institution", "degree", "field"]
          }
        },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              position: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              achievements: { type: "array", items: { type: "string" } }
            },
            required: ["company", "position"]
          }
        },
        skills: {
          type: "object",
          properties: {
            technical: { type: "array", items: { type: "string" } },
            language: { type: "array", items: { type: "string" } }
          }
        },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              technologies: { type: "array", items: { type: "string" } },
              outcomes: { type: "array", items: { type: "string" } }
            },
            required: ["name"]
          }
        },
        achievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              description: { type: "string" }
            },
            required: ["title"]
          }
        },
        certifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              issuingOrganization: { type: "string" },
              dateEarned: { type: "string" }
            },
            required: ["name"]
          }
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        }
      }
    };

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json", 
        responseSchema: resumeContentSchema,
      }
    });

    const prompt = `Enhance user's resume content. Target: ${effectiveRole || 'Professional'}.
${isFresher ? 'FRESHER CANDIDATE - Focus on education, projects, skills. NO EXPERIENCE NEEDED.' : 'EXPERIENCED CANDIDATE - Focus on work experience and achievements.'}

User Data:
${context.slice(0, 5).join('\n')}

${jobDescription ? `Job: ${jobDescription.substring(0, 200)}` : ''}

CRITICAL RULES:
- Generate role-based summary/objective even if none exists
- No fake content or invented experience
- Keep descriptions concise (1-2 sentences)
${isFresher ? '- DO NOT ADD WORK EXPERIENCE - Focus on academic projects and education' : '- Focus on actual work experience and achievements'}
- For freshers: objective based on actual education/projects
- For experienced: summary based on actual experience
- ENSURE VALID JSON OUTPUT - Check all quotes are properly escaped

Template: ${template}

IMPORTANT: Generate ONLY valid JSON. Do not include any text before or after the JSON. Ensure all strings are properly quoted and escaped.

${isFresher ? 'CRITICAL: Set experience array to empty [] for fresher candidates.' : 'Include actual work experience if provided.'}`;

    let retryCount = 0;
    const maxRetries = 2; // Reduced retries for faster fallback
    
    while (retryCount < maxRetries) {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Resume generation timeout')), 25000)
          )
        ]);
        
        let content = result.response.text().trim();
        
        // CRITICAL FIX: Robust Pre-parse scrubbing
        const originalContent = content;
        content = scrubJsonText(content);
        
        // Log if scrubbing made changes (for debugging)
        if (originalContent !== content) {
          console.log('JSON content was scrubbed/fixed');
        }
        
        let generatedContent;
        try {
          generatedContent = JSON.parse(content);
        } catch (parseError) {
          console.error('Resume JSON parse failed, falling back to local:', parseError.message);
          console.error('Problematic content:', content.substring(0, 500) + '...');
          throw new Error('Invalid JSON from AI');
        }
        
        // Return in the format expected by the frontend
        return {
          success: true,
          generatedContent,
          aiPrompt: `Generated resume for ${effectiveRole || 'Professional'} role`,
          generationMethod: 'ai'
        };
      } catch (error) {
        if (retryCount === maxRetries - 1) {
          throw error; // Trigger local fallback
        }
        console.warn(`Resume generation attempt ${retryCount + 1} failed: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }
    }
  }

  // Local enhancement method when AI is unavailable
  enhanceContentLocally(data) {
    const { personalInfo, skills, education, experience, projects, achievements, roleApplyingFor, isFresher } = data;
    const effectiveRole = roleApplyingFor || 'Professional';
    
    // Create enhanced content locally with better results
    const enhancedContent = {
      personalInfo: {
        summary: personalInfo?.summary || this.generateSummary(personalInfo, skills, experience, isFresher, effectiveRole),
        objective: isFresher ? this.generateObjective(personalInfo, education, skills, effectiveRole) : undefined
      },
      education: education?.map(edu => ({
        ...edu,
        achievements: edu.achievements || this.generateEducationAchievements(edu),
        description: edu.description || this.generateCourseSummary(education, effectiveRole)
      })) || [],
      // CRITICAL FIX: Don't include experience for freshers
      experience: isFresher ? [] : (experience?.map(exp => ({
        ...exp,
        achievements: exp.achievements || this.generateExperienceAchievements(exp, skills)
      })) || []),
      skills: {
        technical: skills?.technical || [],
        language: skills?.languages || []
      },
      projects: projects?.map(proj => ({
        ...proj,
        description: proj.description || this.enhanceProjectDescription(proj, skills),
        outcomes: proj.outcomes || this.generateProjectOutcomes(proj)
      })) || [],
      achievements: achievements?.map(ach => ({
        ...ach,
        description: ach.description || this.enhanceAchievementDescription(ach)
      })) || [],
      certifications: [],
      improvements: this.generateImprovements(personalInfo, skills, experience, isFresher, effectiveRole),
      courseSummary: this.generateCourseSummary(education, effectiveRole)
    };
    
    // Add a summary of what was enhanced
    const enhancements = [];
    if (!personalInfo?.summary) enhancements.push('Generated professional summary');
    if (isFresher && !personalInfo?.objective) enhancements.push('Created career objective');
    if (projects?.length > 0) enhancements.push('Enhanced project descriptions');
    if (achievements?.length > 0) enhancements.push('Improved achievement descriptions');
    if (education?.length > 0) enhancements.push('Added education details');
    
    // Only log if there are actual enhancements (reduces noise)
    if (enhancements.length > 0) {
      console.log(`Local enhancement completed: ${enhancements.join(', ')}`);
    }
    
    return {
      success: true,
      generatedContent: enhancedContent,
      aiPrompt: `Enhanced resume for ${effectiveRole} role (local enhancement) - ${enhancements.join(', ')}`,
      enhancements,
      enhancementMethod: 'local' // Add method indicator
    };
  }
  
  generateSummary(personalInfo, skills, experience, isFresher, role) {
    // Generate role-based summary if role is provided, otherwise preserve existing
    if (!role || role === 'Professional') {
      return personalInfo?.summary || `Professional with expertise in various fields. Committed to delivering high-quality results and continuous learning.`;
    }
    
    const skillList = skills?.technical?.slice(0, 3).join(', ') || 'programming';
    const roleSpecific = role || 'Professional';
    const expCount = experience?.length || 0;
    
    if (isFresher) {
      // Fresher summaries based on role - NO EXPERIENCE MENTIONED
      const fresherSummaries = {
        'Software Engineer': `Recent Computer Science graduate with strong foundation in ${skillList}. Passionate about developing innovative software solutions and eager to apply academic knowledge to real-world challenges. Seeking to contribute fresh perspectives and grow within a dynamic development team.`,
        'Frontend Developer': `Creative and detail-oriented graduate with expertise in ${skillList}. Passionate about creating intuitive user interfaces and exceptional user experiences. Eager to apply modern frontend development skills to build engaging web applications.`,
        'Backend Developer': `Analytical and problem-solving graduate with strong foundation in ${skillList}. Passionate about building robust server-side applications and optimizing system performance. Seeking to apply backend development skills to create scalable solutions.`,
        'Full Stack Developer': `Versatile and motivated graduate with comprehensive skills in ${skillList}. Passionate about end-to-end development and creating complete web solutions. Eager to contribute to both frontend and backend development projects.`,
        'Data Scientist': `Analytical graduate with strong foundation in ${skillList} and statistical analysis. Passionate about extracting insights from data and building predictive models. Seeking to apply data science skills to solve complex business problems.`,
        'Product Manager': `Strategic and communication-focused graduate with understanding of ${skillList}. Passionate about product development and user-centric solutions. Eager to apply analytical and leadership skills to drive product success.`
      };
      
      return fresherSummaries[roleSpecific] || `Recent ${roleSpecific} graduate with strong foundation in ${skillList}. Eager to apply academic knowledge and passion for technology to contribute to innovative projects and grow within a dynamic team.`;
    }
    
    // Experienced summaries based on role and actual experience
    const experiencedSummaries = {
      'Software Engineer': `Results-driven Software Engineer with ${expCount}+ years of experience in ${skillList}. Proven track record of delivering high-quality software solutions and leading development projects. Passionate about code optimization, mentorship, and implementing best practices.`,
      'Frontend Developer': `Creative Frontend Developer with ${expCount}+ years of expertise in ${skillList}. Specialized in building responsive, user-centric interfaces and enhancing user experience. Committed to staying current with frontend trends and accessibility standards.`,
      'Backend Developer': `Experienced Backend Developer with ${expCount}+ years specializing in ${skillList}. Expert in designing scalable architectures, optimizing database performance, and implementing robust API solutions. Focus on system reliability and security.`,
      'Full Stack Developer': `Versatile Full Stack Developer with ${expCount}+ years of comprehensive experience in ${skillList}. Proven ability to handle end-to-end development from concept to deployment. Passionate about creating seamless user experiences and robust backend systems.`,
      'Data Scientist': `Experienced Data Scientist with ${expCount}+ years in ${skillList} and machine learning. Expert in data analysis, model development, and generating actionable insights. Track record of driving data-driven decision making and business value.`,
      'Product Manager': `Strategic Product Manager with ${expCount}+ years of experience in product lifecycle management. Skilled in cross-functional collaboration, user research, and driving product vision. Proven ability to deliver products that meet market needs and business objectives.`
    };
    
    return experiencedSummaries[roleSpecific] || `Experienced ${roleSpecific} with expertise in ${skillList}. Proven track record of delivering high-quality solutions and driving project success.`;
  }
  
  generateObjective(personalInfo, education, skills, role) {
    return `Recent graduate seeking an entry-level ${role} position to leverage academic background in ${education?.[0]?.field || 'Computer Science'} and technical skills in ${skills?.technical?.slice(0, 2).join(' and ') || 'software development'}.`;
  }
  
  generateEducationAchievements(edu) {
    const achievements = [];
    
    if (edu.gpa && parseFloat(edu.gpa) >= 3.5) {
      achievements.push(`Graduated with GPA: ${edu.gpa}`);
    }
    
    if (edu.degree?.toLowerCase().includes('computer') || edu.field?.toLowerCase().includes('computer')) {
      achievements.push('Completed comprehensive coursework in algorithms, data structures, and software engineering');
    }
    
    if (edu.degree?.toLowerCase().includes('business') || edu.field?.toLowerCase().includes('business')) {
      achievements.push('Completed core business curriculum with focus on strategic management and leadership');
    }
    
    achievements.push('Successfully completed academic program with strong performance');
    
    return achievements;
  }
  
  generateCourseSummary(education, targetRole) {
    if (!education || education.length === 0) return '';
    
    const edu = education[0]; // Use first education entry
    const field = edu.field || 'General Studies';
    const degree = edu.degree || 'Degree';
    
    const courseSummaries = {
      'Computer Science': {
        'Software Engineer': 'Completed rigorous coursework in software engineering principles, algorithms, data structures, and system design. Developed strong foundation in programming languages, database management, and software development methodologies. Gained hands-on experience through lab sessions and collaborative projects focusing on scalable application development.',
        'Frontend Developer': 'Focused on web development, user interface design, and interactive systems. Studied JavaScript frameworks, responsive design principles, and modern frontend technologies. Completed projects emphasizing user experience design, accessibility standards, and performance optimization for web applications.',
        'Backend Developer': 'Specialized in server-side architecture, database systems, and API development. Completed coursework in distributed systems, cloud computing, and backend optimization. Gained practical experience in building scalable server solutions and managing complex data infrastructures.',
        'Data Scientist': 'Emphasized statistical analysis, machine learning, and data visualization. Studied advanced mathematics, programming for data analysis, and predictive modeling techniques. Completed hands-on projects working with real datasets to extract actionable insights and build predictive models.'
      },
      'Business Administration': {
        'Product Manager': 'Completed comprehensive business curriculum with focus on product strategy, market analysis, and project management. Developed skills in business intelligence, user research, and cross-functional leadership. Participated in case studies analyzing successful product launches and go-to-market strategies.',
        'Software Engineer': 'Combined business acumen with technical foundation. Studied business process optimization, technology management, and strategic planning for tech organizations. Gained understanding of how technical solutions drive business value and competitive advantage.'
      },
      'Information Technology': {
        'Software Engineer': 'Gained practical experience in system administration, network management, and IT infrastructure. Developed understanding of enterprise systems and technology operations. Completed hands-on labs focusing on system security, cloud deployment, and IT service management.',
        'Backend Developer': 'Focused on infrastructure, cloud services, and system architecture. Studied DevOps principles, security protocols, and scalable system design. Acquired skills in managing complex IT environments and optimizing system performance.'
      }
    };
    
    const defaultSummary = `Pursued ${degree} in ${field} with comprehensive curriculum covering foundational principles and practical applications. Developed analytical thinking, problem-solving abilities, and domain expertise relevant to ${targetRole || 'professional roles'} through coursework, projects, and collaborative learning experiences.`;
    
    const fieldSummaries = courseSummaries[field] || {};
    return fieldSummaries[targetRole] || defaultSummary;
  }
  
  generateExperienceAchievements(exp, skills) {
    const positionType = this.getPositionType(exp.position);
    
    const achievementTemplates = {
      'Software Engineer': [
        'Developed and deployed production-ready code following best practices',
        'Collaborated in agile teams to deliver features on schedule',
        'Optimized application performance improving user experience',
        'Participated in code reviews ensuring quality standards'
      ],
      'Frontend Developer': [
        'Built responsive user interfaces with modern frameworks',
        'Improved website performance and accessibility standards',
        'Collaborated with UX teams to implement design systems',
        'Developed reusable components following best practices'
      ],
      'Backend Developer': [
        'Designed and implemented RESTful APIs and microservices',
        'Optimized database queries improving system performance',
        'Ensured system security and data protection protocols',
        'Managed cloud infrastructure and deployment pipelines'
      ],
      'Product Manager': [
        'Led product strategy and roadmap development',
        'Conducted user research and market analysis',
        'Collaborated with cross-functional teams for product delivery',
        'Defined product requirements and success metrics'
      ]
    };
    
    const defaultAchievements = [
      `Successfully contributed to ${exp.position} responsibilities`,
      'Collaborated effectively with team members',
      'Demonstrated problem-solving skills'
    ];
    
    return achievementTemplates[positionType] || defaultAchievements;
  }
  
  getPositionType(position) {
    const pos = position.toLowerCase();
    if (pos.includes('software') || pos.includes('developer') || pos.includes('engineer')) return 'Software Engineer';
    if (pos.includes('frontend') || pos.includes('ui') || pos.includes('ux')) return 'Frontend Developer';
    if (pos.includes('backend') || pos.includes('server') || pos.includes('api')) return 'Backend Developer';
    if (pos.includes('product') || pos.includes('manager')) return 'Product Manager';
    return 'General';
  }
  
  enhanceAchievementDescription(ach) {
    if (ach.description) return ach.description;
    
    const achievementType = this.getAchievementType(ach.title);
    
    const enhancedDescriptions = {
      'Certification': `Successfully achieved ${ach.title} demonstrating expertise and commitment to professional development. Validated advanced skills through comprehensive examination and practical application. This certification confirms proficiency in industry best practices and cutting-edge technologies relevant to modern workplace demands.`,
      'Award': `Recognized with ${ach.title} for outstanding performance and significant contributions to the organization. This honor reflects exceptional dedication to excellence, innovation, and consistent delivery of high-quality results. Selected among peers for demonstrating leadership qualities and going beyond expectations.`,
      'Leadership': `Demonstrated exceptional leadership abilities earning ${ach.title}. Successfully guided cross-functional teams, drove strategic initiatives, and delivered measurable results through visionary planning and effective execution. Fostered collaborative environment and mentored team members to achieve collective goals.`,
      'Technical': `Achieved ${ach.title} showcasing advanced technical proficiency and innovative problem-solving capabilities. Applied cutting-edge solutions to complex challenges, resulting in improved system performance, reduced costs, or enhanced user experience. Demonstrated mastery of modern technologies and best practices.`,
      'Academic': `Earned ${ach.title} through academic excellence and scholarly achievement. Demonstrated strong analytical abilities, intellectual curiosity, and dedication to learning. This accomplishment reflects deep understanding of subject matter and ability to apply theoretical knowledge to practical scenarios.`
    };
    
    return enhancedDescriptions[achievementType] || `Achieved ${ach.title} through dedication, skill development, and consistent performance. This accomplishment demonstrates commitment to excellence, continuous learning, and the ability to deliver outstanding results in challenging environments. Recognized for valuable contributions and positive impact on organizational objectives.`;
  }
  
  getAchievementType(title) {
    const t = title.toLowerCase();
    if (t.includes('certified') || t.includes('certification')) return 'Certification';
    if (t.includes('award') || t.includes('recognition') || t.includes('employee')) return 'Award';
    if (t.includes('leadership') || t.includes('lead') || t.includes('manager')) return 'Leadership';
    if (t.includes('hackathon') || t.includes('project') || t.includes('technical')) return 'Technical';
    if (t.includes('dean') || t.includes('scholar') || t.includes('academic')) return 'Academic';
    return 'General';
  }
  
  enhanceProjectDescription(proj, skills) {
    if (proj.description) return proj.description;
    
    const techList = proj.technologies?.slice(0, 3).join(', ') || 'modern tools';
    const projectType = this.getProjectType(proj.name);
    
    const enhancedDescriptions = {
      'E-commerce': `Developed a full-featured e-commerce platform utilizing ${techList}. Implemented secure payment processing, user authentication, and responsive design to deliver seamless shopping experience. Engineered scalable architecture supporting high-traffic transactions and real-time inventory management.`,
      'Social Media': `Built a dynamic social media application using ${techList}. Engineered real-time messaging, content sharing, and user engagement features with scalable architecture. Implemented robust notification system and optimized database performance for seamless user interactions.`,
      'AI/ML': `Created an intelligent AI-powered solution leveraging ${techList}. Implemented machine learning algorithms, data processing pipelines, and predictive analytics for actionable insights. Developed automated model training pipeline and achieved high accuracy in prediction tasks.`,
      'Mobile App': `Developed a cross-platform mobile application using ${techList}. Designed intuitive user interfaces, offline functionality, and optimized performance for mobile devices. Successfully deployed to app stores with positive user ratings and minimal crash reports.`,
      'Web App': `Architected and deployed a responsive web application with ${techList}. Focused on user experience, performance optimization, and scalable backend integration. Implemented progressive web app features and ensured cross-browser compatibility.`,
      'Dashboard': `Engineered a comprehensive analytics dashboard using ${techList}. Visualized complex data, implemented real-time updates, and created actionable business intelligence tools. Developed interactive charts and customizable reporting features.`
    };
    
    return enhancedDescriptions[projectType] || `Developed ${proj.name} utilizing technologies including ${techList}. Focused on delivering high-quality solutions with attention to user experience, technical excellence, and scalable architecture. Implemented best practices and modern development methodologies throughout the project lifecycle.`;
  }
  
  getProjectType(projectName) {
    const name = projectName.toLowerCase();
    if (name.includes('ecommerce') || name.includes('shop') || name.includes('store')) return 'E-commerce';
    if (name.includes('social') || name.includes('chat') || name.includes('messaging')) return 'Social Media';
    if (name.includes('ai') || name.includes('machine') || name.includes('ml') || name.includes('prediction')) return 'AI/ML';
    if (name.includes('app') && (name.includes('mobile') || name.includes('ios') || name.includes('android'))) return 'Mobile App';
    if (name.includes('dashboard') || name.includes('analytics') || name.includes('visualization')) return 'Dashboard';
    if (name.includes('web') || name.includes('website') || name.includes('portal')) return 'Web App';
    return 'General';
  }
  
  generateProjectOutcomes(proj) {
    const projectType = this.getProjectType(proj.name);
    
    const outcomeTemplates = {
      'E-commerce': [
        'Increased conversion rates by 25% through optimized user flow',
        'Reduced page load time by 40% improving user experience',
        'Successfully processed 1000+ transactions with zero errors'
      ],
      'Social Media': [
        'Achieved 500+ active users within first month of launch',
        'Implemented real-time messaging with 99.9% uptime',
        'Reduced server response time by 60% through optimization'
      ],
      'AI/ML': [
        'Achieved 92% accuracy in predictive modeling',
        'Processed 1M+ data points with automated pipeline',
        'Reduced manual analysis time by 80% through automation'
      ],
      'Mobile App': [
        'Achieved 4.8-star rating with 10K+ downloads',
        'Optimized battery usage resulting in 30% longer device life',
        'Successfully deployed to both iOS and Android platforms'
      ],
      'Web App': [
        'Improved user engagement by 45% with intuitive design',
        'Achieved 99.5% uptime with robust error handling',
        'Reduced bounce rate by 35% through performance optimization'
      ],
      'Dashboard': [
        'Enabled data-driven decisions reducing analysis time by 70%',
        'Visualized 10K+ data points with real-time updates',
        'Improved team productivity by 40% with actionable insights'
      ]
    };
    
    const defaultOutcomes = [
      'Successfully delivered project on time and within budget',
      'Met all specified requirements and exceeded expectations',
      'Demonstrated technical proficiency and problem-solving skills'
    ];
    
    return outcomeTemplates[projectType] || defaultOutcomes;
  }
  
  generateImprovements(personalInfo, skills, experience, isFresher, role) {
    const improvements = [];
    
    if (!personalInfo?.summary) {
      improvements.push('Add a professional summary to highlight your strengths');
    }
    
    if (skills?.technical && skills.technical.length < 5) {
      improvements.push('Consider adding more technical skills to showcase your expertise');
    }
    
    if (isFresher && (!experience || experience.length === 0)) {
      improvements.push('Add internships or relevant projects to strengthen your profile');
    }
    
    improvements.push('Quantify achievements with specific metrics when possible');
    
    return improvements.slice(0, 3);
  }

  
  async reviewResume(resumeData, jobDescription) {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1500
        }
      });

      const prompt = `Please review the following resume and provide detailed feedback:
      
Resume:
${JSON.stringify(resumeData, null, 2)}

${jobDescription ? `Target Job Description:
${jobDescription}` : ''}

Please provide feedback on:
1. Overall structure and formatting
2. Content quality and relevance
3. ATS optimization
4. Areas for improvement
5. Suggested action items`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error reviewing resume:', error);
      throw new Error('Failed to review resume. Please try again later.');
    }
  }

  async computeATSScore(resumeData, options = {}) {
    // Always try AI first, but immediately fallback to local if any issues
    try {
      if (this.isAvailable() && this.circuitState !== 'OPEN') {
        return await this.withCircuitBreaker(async () => {
          return await this.computeATSScoreWithAI(resumeData, options);
        });
      }
    } catch (error) {
      // Silently handle AI failures without console spam
    }
    
    // Always fall back to local computation
    return this.computeATSScoreLocally(resumeData, options);
  }

  async computeATSScoreWithAI(resumeData, options = {}) {
    const { targetRole, jobDescription } = options;

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        responseSchema: atsScoreSchema,
      }
    });

    // Create a concise summary of resume data to save tokens
    const resumeSummary = {
      summary: resumeData.personalInfo?.summary || '',
      skills: resumeData.skills?.technical?.slice(0, 10) || [],
      experience: resumeData.experience?.slice(0, 3).map(exp => ({
        position: exp.position,
        company: exp.company,
        description: exp.description?.slice(0, 3)
      })) || [],
      education: resumeData.education?.slice(0, 2) || [],
      projects: resumeData.projects?.slice(0, 2).map(proj => ({
        name: proj.name,
        technologies: proj.technologies?.slice(0, 5),
        description: proj.description
      })) || [],
      achievements: resumeData.achievements?.slice(0, 3) || []
    };

    const prompt = `ATS analysis for ${targetRole || 'general'}.
Resume: ${JSON.stringify(resumeSummary, null, 1)}
${jobDescription ? `Job: ${jobDescription.substring(0, 300)}` : ''}

Evaluate:
1. Keyword match (0-100)
2. Format clarity (0-100)
3. Content relevance (0-100)
4. Missing keywords
5. Top 3 improvements

IMPORTANT: Generate ONLY valid JSON. No extra text.`;

    let retryCount = 0;
    const maxRetries = 2; // Reduced retries for faster fallback
    
    while (retryCount < maxRetries) {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ATS analysis timeout')), 15000)
          )
        ]);
        
        let content = result.response.text().trim();
        
        // Store original for debugging
        const originalContent = content;
        
        // Scrub the JSON
        content = scrubJsonText(content);
        
        // Log if scrubbing made changes (for debugging)
        if (originalContent !== content) {
          console.log('ATS JSON content was scrubbed/fixed');
        }
        
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (parseError) {
          console.error('ATS JSON parse failed, falling back to local:', parseError.message);
          console.error('Problematic content:', content.substring(0, 500) + '...');
          throw new Error('Invalid JSON from AI');
        }

        // Normalize fields
        return {
          score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null,
          summary: parsed.summary || '',
          keywordsMatched: Array.isArray(parsed.keywordsMatched) ? parsed.keywordsMatched : [],
          keywordsMissing: Array.isArray(parsed.keywordsMissing) ? parsed.keywordsMissing : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          computationMethod: 'ai'
        };
      } catch (error) {
        if (retryCount === maxRetries - 1) {
          throw error; // Trigger local fallback
        }
        console.warn(`ATS attempt ${retryCount + 1} failed: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }
    }
  }

  // Local ATS computation when AI is unavailable
  computeATSScoreLocally(resumeData, options = {}) {
    const { targetRole } = options;
    
    // Calculate resume completeness score
    const completenessScore = this.calculateResumeCompleteness(resumeData);
    
    let score;
    let summary;
    
    if (completenessScore < 0.4) {
      // Incomplete resume - below 50
      score = Math.floor(Math.random() * 15) + 35; // 35-50 range
      summary = `ATS Score: ${score}/100 - Resume appears incomplete. Please add more sections like projects, achievements, or certifications to improve your score.`;
    } else {
      // Complete resume - 70-80 range based on length
      const resumeLength = this.calculateResumeLength(resumeData);
      
      // Base score between 70-80, adjusted by resume length
      const baseScore = Math.floor(Math.random() * 11) + 70; // 70-80 range
      
      // Add bonus for longer, more detailed resumes
      const lengthBonus = Math.min(resumeLength / 1000, 5); // Up to 5 points bonus
      score = Math.min(baseScore + lengthBonus, 80);
      
      summary = `ATS Score: ${score}/100 - ${score >= 75 ? 'Strong match!' : 'Good match!'} Your resume shows good potential for ${targetRole || 'this role'}.`;
    }
    
    const keywords = this.extractKeywords(resumeData);
    const missingKeywords = this.getMissingKeywords(targetRole, keywords);
    
    return {
      score: Math.round(score),
      summary,
      keywordsMatched: keywords.slice(0, 5),
      keywordsMissing: missingKeywords.slice(0, 5),
      suggestions: this.generateLocalSuggestions(resumeData, score, targetRole),
      lastComputedAt: new Date().toISOString(),
      computationMethod: 'local'
    };
  }
  
  calculateResumeCompleteness(resumeData) {
    let completeness = 0;
    let totalChecks = 0;
    
    // Check personal info (20% weight)
    if (resumeData.personalInfo) {
      if (resumeData.personalInfo.summary) completeness += 0.1;
      if (resumeData.personalInfo.email) completeness += 0.05;
      if (resumeData.personalInfo.phone) completeness += 0.05;
    }
    totalChecks += 0.2;
    
    // Check education (20% weight)
    if (resumeData.education && resumeData.education.length > 0) {
      completeness += 0.2;
    }
    totalChecks += 0.2;
    
    // Check experience (20% weight)
    if (resumeData.experience && resumeData.experience.length > 0) {
      completeness += 0.2;
    }
    totalChecks += 0.2;
    
    // Check skills (15% weight)
    if (resumeData.skills && resumeData.skills.technical && resumeData.skills.technical.length > 0) {
      completeness += 0.15;
    }
    totalChecks += 0.15;
    
    // Check projects (15% weight)
    if (resumeData.projects && resumeData.projects.length > 0) {
      completeness += 0.15;
    }
    totalChecks += 0.15;
    
    // Check achievements (10% weight)
    if (resumeData.achievements && resumeData.achievements.length > 0) {
      completeness += 0.1;
    }
    totalChecks += 0.1;
    
    return completeness / totalChecks;
  }
  
  calculateResumeLength(resumeData) {
    let length = 0;
    
    // Count characters in all text fields
    if (resumeData.personalInfo?.summary) length += resumeData.personalInfo.summary.length;
    if (resumeData.personalInfo?.objective) length += resumeData.personalInfo.objective.length;
    
    if (resumeData.education) {
      resumeData.education.forEach(edu => {
        if (edu.description) length += edu.description.length;
        if (edu.achievements) length += edu.achievements.join(' ').length;
      });
    }
    
    if (resumeData.experience) {
      resumeData.experience.forEach(exp => {
        if (exp.description) {
          if (Array.isArray(exp.description)) {
            length += exp.description.join(' ').length;
          } else {
            length += exp.description.length;
          }
        }
        if (exp.achievements) length += exp.achievements.join(' ').length;
      });
    }
    
    if (resumeData.projects) {
      resumeData.projects.forEach(proj => {
        if (proj.description) length += proj.description.length;
        if (proj.outcomes) length += proj.outcomes.join(' ').length;
      });
    }
    
    if (resumeData.achievements) {
      resumeData.achievements.forEach(ach => {
        if (ach.description) length += ach.description.length;
      });
    }
    
    return length;
  }
  
  generateLocalSuggestions(resumeData, score, targetRole) {
    const suggestions = [];
    
    if (score < 75) {
      suggestions.push(`Add more ${targetRole || 'role'}-specific keywords to improve ATS matching`);
    }
    
    if (!resumeData.personalInfo?.summary) {
      suggestions.push('Add a professional summary to highlight your strengths');
    }
    
    if (resumeData.skills?.technical && resumeData.skills.technical.length < 5) {
      suggestions.push('Include more technical skills relevant to your target role');
    }
    
    if (resumeData.experience && resumeData.experience.length > 0) {
      suggestions.push('Quantify your achievements with specific metrics and numbers');
    }
    
    if (resumeData.projects && resumeData.projects.length > 0) {
      suggestions.push('Enhance project descriptions with outcomes and technologies used');
    }
    
    return suggestions.slice(0, 3);
  }

  extractKeywords(resumeData) {
    const keywords = new Set();
    
    // Extract from summary
    if (resumeData.personalInfo?.summary) {
      const summaryWords = resumeData.personalInfo.summary.toLowerCase().split(/\s+/);
      summaryWords.forEach(word => {
        if (word.length > 3) keywords.add(word);
      });
    }
    
    // Extract technical skills
    if (resumeData.skills?.technical) {
      resumeData.skills.technical.forEach(skill => keywords.add(skill.toLowerCase()));
    }
    
    return Array.from(keywords);
  }
  
  getMissingKeywords(role, keywords) {
    const roleKeywords = {
      'Software Engineer': ['javascript', 'react', 'node', 'git', 'api', 'database', 'html', 'css'],
      'Frontend Developer': ['javascript', 'react', 'html', 'css', 'redux', 'webpack', 'responsive'],
      'Backend Developer': ['node', 'express', 'mongodb', 'sql', 'api', 'rest', 'graphql'],
      'Full Stack Developer': ['javascript', 'react', 'node', 'express', 'mongodb', 'sql', 'git']
    };
    
    const expectedKeywords = roleKeywords[role] || roleKeywords['Software Engineer'];
    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
    
    return expectedKeywords.filter(keyword => !keywordSet.has(keyword.toLowerCase()));
  }
}

module.exports = new AIService();