import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ImageStudio from './page/ImageStudio';

// Standalone preview entry, without login or the app shell.
// Dev-only overrides: ?api=<base>&token=<jwt> to point at a local backend.
const params = new URLSearchParams(window.location.search);
const api = params.get('api') || undefined;
const token = params.get('token');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: 24 }}>
      <ImageStudio apiBase={api} token={token} />
    </div>
  </StrictMode>
);
