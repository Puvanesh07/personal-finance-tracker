import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AuthWrapper from './Auth/AuthWrapper' // Import your new AuthWrapper
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthWrapper>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthWrapper>
  </React.StrictMode>,
)