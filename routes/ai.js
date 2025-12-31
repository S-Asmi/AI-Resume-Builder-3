const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const AIService = require('../services/AIService');

const router = express.Router();

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

/**
 * @route   POST /api/ai/generate-resume
 * @desc    Generate resume content using AI
 * @access  Private
 */
router.post('/generate-resume', 
  [
    auth,
    apiLimiter,
    body('jobDescription').optional().isString().trim().escape(),
    body('targetRole').optional().isString().trim().escape(),
    body('industry').optional().isString().trim().escape(),
    body('yearsExperience').optional().isInt({ min: 0 })
  ], 
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await AIService.generateResumeContent(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error generating resume:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate resume content'
      });
    }
  }
);

/**
 * @route   POST /api/ai/enhance
 * @desc    Enhance resume content with AI
 * @access  Private
 */
router.post('/enhance',
  [
    auth,
    apiLimiter,
    body('section').isString().trim().notEmpty(),
    body('content').isString().trim(),
    body('field').isString().trim().notEmpty(),
    body('targetRole').optional().isString().trim(),
    body('jobDescription').optional().isString().trim(),
    body('projectName').optional().isString().trim(),
    body('technologies').optional().isString().trim(),
    body('achievementTitle').optional().isString().trim(),
    body('date').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { 
        section, 
        content, 
        field, 
        targetRole, 
        jobDescription,
        projectName,
        technologies,
        achievementTitle,
        date
      } = req.body;

      const context = {
        field,
        targetRole,
        jobDescription,
        ...(section === 'project' && { projectName, technologies }),
        ...(section === 'achievement' && { achievementTitle, date })
      };

      const result = await AIService.enhanceSection(section, content, context);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({
        success: true,
        enhancedContent: result.enhancedContent
      });
    } catch (error) {
      console.error('Error enhancing content:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to enhance content' 
      });
    }
  }
);

/**
 * @route   POST /api/ai/review-resume
 * @desc    Get AI-powered resume review
 * @access  Private
 */
router.post('/review-resume',
  [
    auth,
    apiLimiter,
    body('resumeData').isObject(),
    body('jobDescription').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resumeData, jobDescription } = req.body;
      const review = await AIService.reviewResume(resumeData, jobDescription);
      
      res.json({ review });
    } catch (error) {
      console.error('Error reviewing resume:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to review resume' 
      });
    }
  }
);

/**
 * @route   POST /api/ai/generate-profile-summary
 * @desc    Generate dynamic profile summary based on role and experience
 * @access  Private
 */
router.post('/generate-profile-summary',
  [
    auth,
    apiLimiter,
    body('roleApplyingFor').isString().trim().notEmpty(),
    body('isFresher').isBoolean(),
    body('skills').optional().isObject(),
    body('experience').optional().isArray(),
    body('education').optional().isArray()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { roleApplyingFor, isFresher, skills, experience, education } = req.body;
      
      const result = await AIService.generateProfileSummary({
        roleApplyingFor,
        isFresher,
        skills,
        experience,
        education
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({
        success: true,
        summary: result.summary,
        objective: result.objective
      });
    } catch (error) {
      console.error('Error generating profile summary:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to generate profile summary' 
      });
    }
  }
);

/**
 * @route   POST /api/ai/enhance-sections
 * @desc    Enhance multiple sections (projects, achievements, courses) with AI
 * @access  Private
 */
router.post('/enhance-sections',
  [
    auth,
    apiLimiter,
    body('sections').isObject(),
    body('roleApplyingFor').optional().isString().trim(),
    body('isFresher').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { sections, roleApplyingFor, isFresher } = req.body;
      
      const result = await AIService.enhanceMultipleSections(sections, {
        roleApplyingFor,
        isFresher
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json({
        success: true,
        enhancedSections: result.enhancedSections
      });
    } catch (error) {
      console.error('Error enhancing sections:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to enhance sections' 
      });
    }
  }
);

module.exports = router;
