import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'katex/dist/katex.min.css';
import { NativeDialogProvider } from './context/NativeDialogContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NativeDialogProvider>
      <App />
    </NativeDialogProvider>
  </React.StrictMode>,
);
