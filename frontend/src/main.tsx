import './index.css'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(

    <ErrorBoundary>
      <App />
    </ErrorBoundary>

);
