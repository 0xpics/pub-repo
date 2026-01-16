import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js'; // Importação do gráfico
import { InfraStatus } from './infra.model';

// Registra todos os componentes necessários do Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private http = inject(HttpClient);
  
  // Referência ao elemento <canvas #meuGrafico> do HTML
  @ViewChild('meuGrafico') elementoGrafico!: ElementRef;

  // Signals para manter a reatividade moderna
  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  
  // Variável para armazenar a instância do gráfico e podermos atualizar/destruir
  chart: any;

  ngOnInit() {
    this.carregarInfra();
    // Chamamos a API de telemetria logo no início para o gráfico não abrir vazio
    this.chamarApi();
  }

  // Busca os dados de telemetria e atualiza o gráfico
  chamarApi() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data';
    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.dados.set(res);
        this.renderizarGrafico(res);
      },
      error: (err) => {
        console.error('Erro na telemetria:', err);
      }
    });
  }

  renderizarGrafico(listaDados: any[]) {
    // Se não houver dados ou o elemento canvas não existir, cancela
    if (!listaDados || listaDados.length === 0 || !this.elementoGrafico) return;

    // Invertemos para que o gráfico mostre do mais antigo para o mais recente (esquerda para direita)
    const dadosInvertidos = [...listaDados].reverse();
    
    // Extraímos as horas e os valores
    const labels = dadosInvertidos.map(d => new Date(d.data_envio).toLocaleTimeString());
    const valores = dadosInvertidos.map(d => d.valor);

    // Se já existir um gráfico, destruímos para criar um novo (evita sobreposição visual)
    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Valor da Telemetria',
          data: valores,
          borderColor: '#007bff',
          backgroundColor: 'rgba(0, 123, 255, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3, // Deixa a linha levemente curva (mais elegante)
          pointRadius: 4,
          pointBackgroundColor: '#007bff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false } // Oculta a legenda para ficar mais limpo
        },
        scales: {
          y: { beginAtZero: false, grid: { color: '#eee' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Busca os metadados do Partman e Cron (Sua governança)
  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar infra:', err)
    });
  }
}