# Chatbot Web Application

A full-stack web application with user authentication and AI-powered chatbot functionality.

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database (built-in, no setup required)
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Google Gemini AI** - LLM integration

### Frontend
- **React** - UI library
- **Axios** - HTTP client
- **React Router** - Client-side routing
- **CSS3** - Styling

## Features

- ✅ User registration and login
- ✅ JWT-based authentication
- ✅ Secure password hashing
- ✅ Real-time chat interface
- ✅ AI-powered responses using OpenAI
- ✅ Modern, responsive UI
- ✅ Session management
- ✅ Message history with timestamps

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** or **yarn**
- **Google Gemini API Key**

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd final_email_generator
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```
   
   Or install them separately:
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend && npm install && cd ..
   
   # Install frontend dependencies
   cd frontend && npm install && cd ..
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the backend directory:
   ```bash
   cp backend/env_example.txt backend/.env
   ```
   
   Edit the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   SECRET_KEY=your-secret-key-here
   JWT_SECRET=your-jwt-secret-here
   
   # Database Configuration (SQLite - no configuration needed)
   # The database file will be created automatically in backend/users.db
   
   # Gemini AI Configuration
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

5. **Database Setup**
   
   SQLite database will be created automatically when you first run the application. No additional setup required!

## Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   npm run backend
   ```
   This will start the server on `http://localhost:5000`

2. **Start the frontend application**
   ```bash
   npm run frontend
   ```
   This will start the React app on `http://localhost:3000`

3. **Or run both simultaneously**
   ```bash
   npm run dev
   ```

### Production Mode

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/user` - Get current user info
- `GET /api/check-auth` - Check authentication status

### Chat
- `POST /api/chat` - Send message to AI chatbot

## Usage

1. **Register/Login**: Visit the application and create an account or login with existing credentials.

2. **Start Chatting**: Once authenticated, you'll be redirected to the chat interface where you can:
   - Send messages to the AI assistant
   - View conversation history
   - See real-time responses
   - Logout when done

## Project Structure

```
final_email_generator/
├── package.json           # Root package.json with scripts
├── README.md              # This file
├── backend/               # Node.js backend
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── .env               # Environment variables
│   └── env_example.txt    # Environment template
└── frontend/              # React frontend
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Auth.js    # Authentication component
    │   │   └── Chat.js    # Chat interface component
    │   ├── App.js         # Main app component
    │   ├── App.css        # App styles
    │   ├── index.js       # React entry point
    │   └── index.css      # Global styles
    └── package.json       # Frontend dependencies
```

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Session management
- CORS configuration
- Input validation
- Error handling

## Customization

### Changing the AI Model
Edit the `backend/server.js` file and modify the Gemini configuration:
```javascript
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
// You can change to other models like "gemini-pro-vision" for image support
```

### Styling
Modify the CSS files in `client/src/` to customize the appearance:
- `index.css` - Global styles
- `App.css` - App-specific styles

## Troubleshooting

### Common Issues

1. **Database Error**
   - SQLite database file will be created automatically
   - Check file permissions in the backend folder

2. **Gemini API Error**
   - Verify your `GEMINI_API_KEY` is correct
   - Check your Google AI Studio account
   - Ensure the API key has proper permissions

3. **Port Already in Use**
   - Change the `PORT` in `.env`
   - Kill processes using the port: `npx kill-port 5000`

4. **CORS Issues**
   - Ensure the frontend is running on `http://localhost:3000`
   - Check CORS configuration in `server.js`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. 
