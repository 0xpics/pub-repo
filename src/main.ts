import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app'; // O nome aqui deve ser igual ao 'export class App'

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));