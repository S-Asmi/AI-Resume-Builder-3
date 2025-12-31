const express = require('express');
const Resume = require('../models/Resume');
const AIService = require('../services/AIService');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/resume
// @desc    Get all resumes for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user })
      .select('title template aiGenerated version isPublic publicLink lastModified createdAt ats')
      .sort({ lastModified: -1 });

    res.json(resumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/resume/:id
// @desc    Get specific resume
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      user: req.user
    });

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json(resume);
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/resume/public/:link
// @desc    Get public resume
// @access  Public
router.get('/public/:link', async (req, res) => {
  try {
    const resume = await Resume.findOne({
      publicLink: req.params.link,
      isPublic: true
    });

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json(resume);
  } catch (error) {
    console.error('Get public resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/resume
// @desc    Create new resume
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, template, personalInfo, education, experience, skills, projects, achievements } = req.body;
    
    // Debug: Log incoming data
    console.log('POST /api/resume - Incoming data:', {
      projects: projects,
      achievements: achievements,
      projectsLength: projects?.length || 0,
      achievementsLength: achievements?.length || 0,
      fullBody: { ...req.body }
    });

    const resume = new Resume({
      user: req.user,
      title: title || 'My Resume',
      template: template || 'professional',
      personalInfo,
      education,
      experience,
      skills,
      projects,
      achievements
    });

    await resume.save();
    
    // Debug: Log saved data
    console.log('POST /api/resume - Saved resume:', {
      projects: resume.projects,
      achievements: resume.achievements,
      projectsLength: resume.projects?.length || 0,
      achievementsLength: resume.achievements?.length || 0
    });
    
    res.status(201).json(resume);
  } catch (error) {
    console.error('Create resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/resume/:id
// @desc    Update resume
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    // Debug: Log incoming data
    console.log('PUT /api/resume/:id - Incoming data:', {
      id: req.params.id,
      projects: req.body.projects,
      achievements: req.body.achievements,
      projectsLength: req.body.projects?.length || 0,
      achievementsLength: req.body.achievements?.length || 0,
      fullBody: { ...req.body }
    });
    
    // Get the existing resume to preserve fields that are not being updated
    const existingResume = await Resume.findOne({
      _id: req.params.id,
      user: req.user
    });
    
    if (!existingResume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Create update object, preserving existing fields for any undefined values
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      // Only update the field if it's not undefined
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });
    
    // Always update the lastModified timestamp
    updateData.lastModified = new Date();
    
    const resume = await Resume.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Debug: Log updated data
    console.log('PUT /api/resume/:id - Updated resume:', {
      projects: resume.projects,
      achievements: resume.achievements,
      projectsLength: resume.projects?.length || 0,
      achievementsLength: resume.achievements?.length || 0
    });

    res.json(resume);
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/resume/:id
// @desc    Delete resume
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({
      _id: req.params.id,
      user: req.user
    });

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/resume/:id/public
// @desc    Toggle resume public status
// @access  Private
router.put('/:id/public', auth, async (req, res) => {
  try {
    const { isPublic } = req.body;
    
    const resume = await Resume.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user
      },
      {
        isPublic,
        publicLink: isPublic ? `resume-${req.params.id.slice(-8)}` : null,
        lastModified: new Date()
      },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json(resume);
  } catch (error) {
    console.error('Toggle public status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/resume/:id/duplicate
// @desc    Duplicate resume
// @access  Private
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const originalResume = await Resume.findOne({
      _id: req.params.id,
      user: req.user
    });

    if (!originalResume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    const duplicatedResume = new Resume({
      ...originalResume.toObject(),
      _id: undefined,
      title: `${originalResume.title} (Copy)`,
      version: 1,
      isPublic: false,
      publicLink: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await duplicatedResume.save();
    res.status(201).json(duplicatedResume);
  } catch (error) {
    console.error('Duplicate resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// @route   POST /api/resume/:id/ats
// @desc    Compute and store ATS score for a resume
// @access  Private
router.post('/:id/ats', auth, async (req, res) => {
  try {
    const { jobDescription, targetRole } = req.body || {};

    const resume = await Resume.findOne({ _id: req.params.id, user: req.user });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Prepare data for ATS scoring
    const resumeData = resume.toObject();

    const ats = await AIService.computeATSScore(resumeData, {
      targetRole: targetRole || resume.roleApplyingFor,
      jobDescription
    });

    // Persist ATS info
    resume.ats = {
      score: ats.score,
      summary: ats.summary,
      keywordsMatched: ats.keywordsMatched,
      keywordsMissing: ats.keywordsMissing,
      lastComputedAt: new Date()
    };
    await resume.save();

    return res.json({ ats });
  } catch (error) {
    console.error('ATS score error:', error);
    
    // Handle specific Google AI errors gracefully
    if (error.code === 'insufficient_quota' || error.status === 503) {
      return res.status(503).json({ 
        message: 'Google AI API quota exceeded. Please check your billing details.',
        error: 'QUOTA_EXCEEDED'
      });
    }
    
    if (error.code === 'rate_limit_exceeded' || error.status === 429) {
      return res.status(429).json({ 
        message: 'Rate limit exceeded. Please try again in a moment.',
        error: 'RATE_LIMIT'
      });
    }
    
    return res.status(500).json({ 
      message: 'Failed to compute ATS score',
      error: 'INTERNAL_ERROR'
    });
  }
});
