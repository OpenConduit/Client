import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';

createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
