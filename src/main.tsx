import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/app/App';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
