import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html', // Ele vai ler o app.html que limpamos acima
})
export class AppComponent {
  private http = inject(HttpClient);
  dados = signal<any>(null);

  chamarApi() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data';
    
    this.http.get(url).subscribe({
      next: (res) => {
        this.dados.set(res);
      },
      error: (err) => {
        console.error('Erro na chamada:', err);
        alert('Erro ao conectar com a AWS. Verifique o console (F12).');
      }
    });
  }
}