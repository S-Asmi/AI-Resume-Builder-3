const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  institution: String,
  degree: String,
  field: String,
  startDate: String,
  endDate: String,
  isCurrent: { type: Boolean, default: false },
  gpa: String,
  description: String
});

const experienceSchema = new mongoose.Schema({
  company: String,
  position: String,
  location: String,
  startDate: String,
  endDate: String,
  current: Boolean,
  description: [String]
});

const projectSchema = new mongoose.Schema({
  name: String,
  description: String,
  technologies: [String],
  link: String,
  github: String
});

const achievementSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: String
});

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'My Resume'
  },
  template: {
    type: String,
    required: true,
    enum: ['plain', 'sidebar', 'topbar', 'modernpro', 'executive', 'compact', 'minimal', 'professional', 'modern', 'creative', 'elegant'],
    default: 'plain'
  },
  personalInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    location: String,
    linkedin: String,
    github: String,
    website: String,
    summary: String,
    avatar: String
  },
  education: [educationSchema],
  experience: [experienceSchema],
  skills: {
    technical: [String],
    soft: [String],
    languages: [String]
  },
  projects: [projectSchema],
  achievements: [achievementSchema],
  roleApplyingFor: String,
  isFresher: { type: Boolean, default: false },
  theme: {
    primary: String,
    accent: String,
    sidebarBg: String
  },
  showPhoto: {
    type: Boolean,
    default: false
  },
  onePage: {
    type: Boolean,
    default: false
  },
  certifications: [{
    name: String,
    issuer: String,
    date: String,
    link: String
  }],
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiPrompt: String,
  version: {
    type: Number,
    default: 1
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  publicLink: String,
  lastModified: {
    type: Date,
    default: Date.now
  },
  // ATS scoring fields
  ats: {
    score: { type: Number, default: null },
    summary: { type: String, default: '' },
    keywordsMatched: { type: [String], default: [] },
    keywordsMissing: { type: [String], default: [] },
    lastComputedAt: { type: Date, default: null }
  }
}, {
  timestamps: true
});

// Generate public link
resumeSchema.pre('save', function(next) {
  if (this.isPublic && !this.publicLink) {
    this.publicLink = `resume-${this._id.toString().slice(-8)}`;
  }
  next();
});

module.exports = mongoose.model('Resume', resumeSchema);
