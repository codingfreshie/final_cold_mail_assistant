import React, { useState } from 'react';
import axios from 'axios';

const Chat = ({ user, onLogout }) => {
  const [receiverEmail, setReceiverEmail] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [emailTopic, setEmailTopic] = useState('');
  const [genStatus, setGenStatus] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');

  const handleResumeChange = (e) => {
    const file = e.target.files?.[0];
    setUploadStatus('');
    if (!file) {
      setResumeFile(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setUploadStatus('Only PDF files are allowed.');
      e.target.value = '';
      setResumeFile(null);
      return;
    }
    setResumeFile(file);
  };

  const handleUploadResume = async (e) => {
    e.preventDefault();
    setUploadStatus('');

    if (!resumeFile) {
      setUploadStatus('Please choose a PDF resume to upload.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const { data } = await axios.post('http://localhost:3001/api/upload-resume', formData);

      const suffix = data?.dbPath ? ` Path: ${data.dbPath}` : '';
      setUploadStatus(`${data?.message || 'Resume uploaded and processed successfully.'}${suffix}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to upload/process resume.';
      setUploadStatus(msg);
    }
  };

  const handleGenerateEmail = async () => {
    setGenStatus('');
    setGeneratedSubject('');
    setGeneratedBody('');
    if (!emailTopic.trim()) {
      setGenStatus('Please enter an email topic.');
      return;
    }
    try {
      const { data } = await axios.post('http://localhost:3001/api/generate-email', { topic: emailTopic });
      setGeneratedSubject(data.subject || '');
      setGeneratedBody(data.body || '');
      setGenStatus('Generated successfully.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate email.';
      setGenStatus(msg);
    }
  };

  const handleSendMail = async () => {
    setSendStatus('');
    if (!receiverEmail) {
      setSendStatus('Please enter a receiver email.');
      return;
    }
    try {
      const payload = { receiverEmail };
      if (emailTopic) payload.topic = emailTopic;
      if (generatedSubject && generatedBody) {
        payload.subject = generatedSubject;
        payload.body = generatedBody;
      }
      const { data } = await axios.post('http://localhost:3001/api/send-mail', payload);
      setSendStatus(data?.message || 'Email sent successfully.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send email.';
      setSendStatus(msg);
    }
  };

  return (
    <div className="container">
      <div className="chat-container">
        <div className="chat-header">
          <h2>Email Assistant</h2>
          <div>
            <span style={{ marginRight: '15px', fontSize: '14px' }}>
              Welcome, {user?.username}!
            </span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label htmlFor="receiverEmail" style={{ fontSize: '14px' }}>Receiver Email</label>
            <input
              id="receiverEmail"
              type="email"
              placeholder="name@example.com"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label htmlFor="emailTopic" style={{ fontSize: '14px' }}>Email Topic</label>
            <input
              id="emailTopic"
              type="text"
              placeholder="e.g., Draft an email to ..."
              value={emailTopic}
              onChange={(e) => setEmailTopic(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="send-btn" style={{ height: '36px' }} onClick={handleGenerateEmail}>
              Generate Email
            </button>
            {genStatus && (
              <span style={{ fontSize: '13px', color: genStatus.toLowerCase().includes('success') ? 'green' : 'crimson' }}>
                {genStatus}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '14px' }}>Generated Preview</label>
            <textarea
              readOnly
              value={generatedSubject || generatedBody ? `Subject: ${generatedSubject}\n\n${generatedBody}` : ''}
              placeholder="Click Generate Email to see the preview here"
              style={{ minHeight: '160px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="send-btn" style={{ height: '36px' }} onClick={handleSendMail}>
              Send Mail
            </button>
            {sendStatus && (
              <span style={{ fontSize: '13px', color: sendStatus.toLowerCase().includes('success') ? 'green' : 'crimson' }}>
                {sendStatus}
              </span>
            )}
          </div>

          <form onSubmit={handleUploadResume} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <label htmlFor="resume" style={{ fontSize: '14px' }}>Upload Resume (PDF only)</label>
              <input
                id="resume"
                type="file"
                accept="application/pdf"
                onChange={handleResumeChange}
              />
            </div>
            <button type="submit" className="send-btn" style={{ height: '36px' }}>
              Upload & Process
            </button>
            {uploadStatus && (
              <span style={{ fontSize: '13px', color: uploadStatus.toLowerCase().includes('success') ? 'green' : 'crimson' }}>
                {uploadStatus}
              </span>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat; 