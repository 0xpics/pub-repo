import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { InfraStatus } from './infra.model'; // Certifique-se de ter criado este arquivo

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private http = inject(HttpClient);
  
  // Signal para os dados de telemetria (o que você já tinha)
  dados = signal<any>(null);
  
  // Signal para os dados de infraestrutura (o que vamos mostrar pro supervisor)
  statusInfra = signal<InfraStatus | null>(null);

  ngOnInit() {
    this.carregarInfra();
  }

  // Busca os metadados do Partman e Cron
  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar infra:', err)
    });
  }

  // Busca os dados de telemetria (seu botão original)
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