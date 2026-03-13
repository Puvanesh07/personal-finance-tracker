import './index.css';

import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';

// Mount into <main id="root"> — satisfies "Document does not have a main landmark"
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthWrapper>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthWrapper>
  </React.StrictMode>,
);
