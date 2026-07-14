import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { handleOAuthCallback } from './lib/anilist-auth.js';

handleOAuthCallback();

const app = mount(App, { target: document.getElementById('app') });

export default app;
