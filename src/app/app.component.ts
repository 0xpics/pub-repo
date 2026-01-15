import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="text-align:center; margin-top: 50px;">
      <h1>Meu Projeto Fullstack AWS</h1>
      <button (click)="chamarApi()" style="padding: 10px 20px; cursor: pointer;">
        Chamar API Gateway
      </button>
      
      <div *ngIf="dados" style="margin-top: 20px; background: #f4f4f4; padding: 20px;">
        <h3>Resposta da AWS:</h3>
        <pre>{{ dados | json }}</pre>
      </div>
    </div>
  `
})
export class AppComponent {
  http = inject(HttpClient);
  dados: any;

  chamarApi() {
    // IMPORTANTE: Adicione o /data no final da sua URL
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data';
    
    this.http.get(url).subscribe({
      next: (res) => this.dados = res,
      error: (err) => alert('Erro de CORS ou Conexão! Verifique o console.')
    });
  }
}