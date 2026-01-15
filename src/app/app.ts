import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule], // Removi o RouterOutlet por enquanto para evitar erros de rota
  templateUrl: './app.html',
})
export class App {
  private http = inject(HttpClient);
  dados = signal<any>(null);

  chamarApi() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data';
    this.http.get(url).subscribe({
      next: (res) => this.dados.set(res),
      error: (err) => {
        console.error(err);
        alert('Erro ao conectar. Veja o F12.');
      }
    });
  }
}