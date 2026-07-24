import React, { useState } from 'react';

export default function GDPRBanner() {
  const [accepted, setAccepted] = useState(
    localStorage.getItem('gdpr-accepted') === 'true'
  );

  if (accepted) return null;

  const handleAccept = () => {
    localStorage.setItem('gdpr-accepted', 'true');
    localStorage.setItem('gdpr-accepted-at', new Date().toISOString());
    setAccepted(true);
  };

  return (
    <div className="gdpr-banner">
      <p>We use cookies to improve your experience. By using our site, you consent to our cookie policy.</p>
      <button onClick={handleAccept}>Accept</button>
      <a href="/privacy">Privacy Policy</a>
    </div>
  );
}
