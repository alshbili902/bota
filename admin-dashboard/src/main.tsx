import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AdminAuthProvider>
        <App />
      </AdminAuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
