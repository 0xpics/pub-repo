import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="text-align:center; margin-top: 50px;">
      <h1>API AWS Conectada!</h1>
      <button (click)="chamarApi()" style="padding: 10px 20px; font-size: 16px;">
        Testar Conexão com Lambda
      </button>
      
      <div *ngIf="dados" style="margin-top: 20px; color: green;">
        <h3>Resposta:</h3>
        <pre>{{ dados | json }}</pre>
      </div>
    </div>
  `
})
export class AppComponent {
  http = inject(HttpClient);
  dados: any;

  chamarApi() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data';
    this.http.get(url).subscribe({
      next: (res) => this.dados = res,
      error: (err) => {
        console.error(err);
        alert('Erro de CORS ou API. Verifique o console (F12).');
      }
    });
  }
}