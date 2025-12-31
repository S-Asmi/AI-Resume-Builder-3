<div align="center">
  <h1>✨ AI Resume Builder</h1>
  <p>A modern, AI-powered resume builder that helps you create professional, ATS-friendly resumes with AI assistance</p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-brightgreen)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  
  ![Dashboard Preview](https://via.placeholder.com/800x400/4F46E5/FFFFFF?text=AI+Resume+Builder+Dashboard)
</div>
## 🏗️ Project Structure

```
resume-builder/
├── client/           # Frontend React application
├── server/           # Backend Node.js/Express server
├── .env              # Environment variables (not in version control)
├── .env.example      # Example environment variables
├── package.json      # Root project configuration
└── README.md         # This file
```

## 📄 Documentation

1. **[SETUP.md](SETUP.md)** - Complete setup guide (first-time installation)
2. **[START.md](START.md)** - Quick start guide (daily usage)
3. [API Documentation](#) - API reference (coming soon)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Icons by [Lucide](https://lucide.dev/)
- Powered by Google's Gemini models

## 🚀 Features

### ✨ Core Features
- **AI-Powered Content Generation** - Generate professional, tailored content with Google AI
- **Smart Resume Building** - Step-by-step guided resume creation
- **Multiple Templates** - Choose from various ATS-friendly designs
- **Real-time Preview** - See changes as you build
- **PDF Export** - Download your resume as a professional PDF

### 🚀 Advanced Features
- **Dark/Light Mode** - Toggle between themes
- **AI Enhancements** - Improve sections with AI suggestions
- **Version Control** - Track different versions of your resumes
- **Responsive Design** - Works on all devices

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **Tailwind CSS** - Utility-first CSS framework for styling
- **React Router** - Client-side routing
- **Axios** - HTTP client for API requests
- **React Hook Form** - Form state management
- **Framer Motion** - Animation library
- **Lucide React** - Beautiful icon library
- **html2pdf.js** - PDF generation from HTML

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Google AI API** - AI content generation (gemini-2.5-flash)
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Development Tools
- **Concurrently** - Run multiple commands simultaneously
- **Nodemon** - Auto-restart server during development
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v18.x LTS required - Hydrogen)
- **npm** or **yarn**
- **MongoDB** (local installation or MongoDB Atlas account)
- **Google AI API Key** (for AI features)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ai-resume-builder
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all dependencies (frontend + backend)
npm run install-all
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your configuration
nano .env
```

### 4. Configure Environment Variables
Update the `.env` file with your specific values:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ai-resume-builder

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Google AI Configuration
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

### 5. Start the Application

#### Development Mode (Recommended)
```bash
# Start both frontend and backend simultaneously
npm run dev
```

#### Individual Start
```bash
# Start backend only
npm run server

# Start frontend only (in a new terminal)
npm run client
```

### 6. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## 📖 Usage Guide

### 1. Getting Started
1. Visit the application at `http://localhost:3000`
2. Click "Get Started" to create an account
3. Complete the registration process
4. You'll be redirected to the dashboard

### 2. Creating Your First Resume
1. Click "Create New Resume" from the dashboard
2. Fill out the multi-step form:
   - **Step 1**: Personal Information
   - **Step 2**: Education
   - **Step 3**: Work Experience
   - **Step 4**: Skills
   - **Step 5**: Projects
   - **Step 6**: Achievements
3. Use the "Generate with AI" button to enhance your content
4. Save your progress

### 3. Choosing a Template
1. After saving, you'll be redirected to the template selector
2. Choose from the following templates:
   - **Minimal**: Clean and simple design
   - **Professional**: Traditional business style
   - **Creative**: Modern and visually appealing
   - **Elegant (No Photo)**: Premium serif design, no avatar
   - **Elegant (Photo)**: Same elegant style with avatar support
   - **Sidebar (No Photo)**: Two-column layout with compact sidebar
   - **Sidebar (Photo)**: Two-column layout with avatar in sidebar
3. Preview each template before making your selection

### 4. Preview and Download
1. Review your resume in the chosen template
2. Make any final edits if needed
3. Download as PDF or share via public link
4. Save to your account for future editing

### 5. Managing Resumes
- **Dashboard**: View all your saved resumes
- **Edit**: Modify existing resumes
- **Duplicate**: Create copies for different job applications
- **Delete**: Remove unwanted resumes
- **Public/Private**: Toggle resume visibility

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Resumes
- `GET /api/resume` - Get all user resumes
- `GET /api/resume/:id` - Get specific resume
- `POST /api/resume` - Create new resume
- `PUT /api/resume/:id` - Update resume
- `DELETE /api/resume/:id` - Delete resume
- `PUT /api/resume/:id/public` - Toggle public status
- `POST /api/resume/:id/duplicate` - Duplicate resume
- `GET /api/resume/public/:link` - Get public resume

### AI Features
- `POST /api/ai/generate-resume` - Generate AI content with tailoring
- `POST /api/ai/enhance-section` - Enhance specific sections
- `POST /api/ai/suggest-improvements` - Get improvement suggestions (ATS keywords, structure, impact, tone)

## 🧭 Tips for Best Results

- **Tailor with JD**: In the builder, provide a job title and paste the job description for best AI results.
- **Pick the right template**: Use photo templates for creative roles; use no-photo templates for strict ATS pipelines.
- **Bullet quality**: Keep bullets concise, quantify impact, and include relevant keywords.

## 🌐 Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-resume-builder
JWT_SECRET=your-production-jwt-secret
GOOGLE_AI_API_KEY=your-google-ai-api-key
CLIENT_URL=https://yourdomain.com
```

### Build for Production
```bash
# Build the frontend
npm run build

# Start production server
npm start
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password security
- **CORS Protection**: Configured cross-origin requests
- **Rate Limiting**: API rate limiting to prevent abuse
- **Helmet**: Security headers middleware
- **Input Validation**: Server-side validation for all inputs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/ai-resume-builder/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🙏 Acknowledgments

- Google AI for providing the AI capabilities
- Tailwind CSS for the beautiful styling framework
- React community for the excellent ecosystem
- All contributors who help improve this project

---

**Happy Resume Building! 🚀**
