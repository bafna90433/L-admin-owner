import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AiCouncil from './page/AiCouncil';

// Standalone preview entry: renders the AI Council page on its own, without
// login or the app shell, so the design can be reviewed quickly.
// Dev-only overrides: ?api=<base>&token=<jwt> to point it at a local backend.
const params = new URLSearchParams(window.location.search);
const api = params.get('api') || undefined;
const token = params.get('token');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: 24 }}>
      <AiCouncil apiBase={api} token={token} />
    </div>
  </StrictMode>
);
