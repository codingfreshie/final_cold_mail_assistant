import React, { useState } from 'react';

const Auth = ({ onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!username || !password) {
      setMessage('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const result = isLogin 
        ? await onLogin(username, password)
        : await onRegister(username, password);

      if (result.success) {
        if (isLogin) {
          setMessage('Login successful!');
        } else {
          setMessage('Registration successful! Please login.');
          setIsLogin(true);
          setUsername('');
          setPassword('');
        }
      } else {
        setMessage(result.error);
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setMessage('');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        
        {message && (
          <div className={message.includes('successful') ? 'success-message' : 'error-message'}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="auth-toggle">
          <button type="button" onClick={toggleMode}>
            {isLogin 
              ? "Don't have an account? Register here" 
              : "Already have an account? Login here"
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth; 