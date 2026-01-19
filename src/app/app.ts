import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js'; 
import { InfraStatus } from './infra.model';

Chart.register(...registerables);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private http = inject(HttpClient);
  
  @ViewChild('meuGrafico') elementoGrafico!: ElementRef;

  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  chart: any;

  ngOnInit() {
    this.carregarInfra();
    // Por padrão, iniciamos com o conceito de Time Bucket (agrupado por minuto)
    this.chamarApi(undefined, undefined, 'minute');
  }

  // --- ATUALIZAÇÃO: Agora aceita Filtros e Bucket ---
  chamarApi(inicio?: string, fim?: string, agrupamento: string = 'minute') {
    // Definimos a base da URL
    let url = `https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data?bucket=${agrupamento}`;

    // Adicionamos os filtros de Data/Range se existirem
    if (inicio) url += `&start_date=${inicio}`;
    if (fim) url += `&end_date=${fim}`;

    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.dados.set(res);
        this.renderizarGrafico(res, agrupamento);
      },
      error: (err) => {
        console.error('Erro na telemetria:', err);
      }
    });
  }

  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!listaDados || listaDados.length === 0 || !this.elementoGrafico) return;

    const dadosInvertidos = [...listaDados].reverse();
    
    // Ajuste de labels: Se for bucket de "day", mostra data. Se for "minute/hour", mostra hora.
    const labels = dadosInvertidos.map(d => {
      const data = new Date(d.data_envio);
      return bucket === 'day' ? data.toLocaleDateString() : data.toLocaleTimeString();
    });

    const valores = dadosInvertidos.map(d => d.valor);

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
          tension: 0.3, 
          pointRadius: 4,
          pointBackgroundColor: '#007bff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false } 
        },
        scales: {
          y: { beginAtZero: false, grid: { color: '#eee' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar infra:', err)
    });
  }
}