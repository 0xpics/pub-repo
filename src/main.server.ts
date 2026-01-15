import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app'; // Verifique se está 'App' aqui também
import { config } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(App, config);

export default bootstrap;