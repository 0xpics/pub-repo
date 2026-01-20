import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
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
  private readonly API_BASE = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com';

  @ViewChild('meuGrafico') elementoGrafico!: ElementRef;

  // Signals para estado reativo
  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  isLoading = signal<boolean>(false);
  chart: Chart | null = null;

  ngOnInit() {
    this.carregarInfra();
    // Inicialização: Busca dados do dia atual (Time Bucket: Minute)
    const hoje = new Date().toISOString().split('T')[0];
    this.buscarDados(hoje, hoje, 'minute');
  }

  /**
   * Implementação dos 3 Conceitos de Banco de Dados Particionado:
   * 1. Filtro por Data (Single Day)
   * 2. Filtro por Range (Start/End)
   * 3. Time Bucket (Agrupamento via Extension/SQL)
   */
  buscarDados(inicio?: string, fim?: string, bucket: string = 'hour') {
    this.isLoading.set(true);

    // Uso de HttpParams para garantir que a query string seja montada corretamente
    // Isso é vital para que o RDS receba as datas no formato que o pg_partman espera
    let params = new HttpParams().set('bucket', bucket);

    if (inicio) params = params.set('start_date', inicio);
    if (fim) params = params.set('end_date', fim);

    this.http.get<any[]>(`${this.API_BASE}/data`, { params }).subscribe({
      next: (res) => {
        this.dados.set(res);
        this.renderizarGrafico(res, bucket);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erro ao buscar telemetria:', err);
        this.isLoading.set(false);
      }
    });
  }

  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!this.elementoGrafico || !listaDados.length) return;

    // RDS com Partman geralmente retorna ordenado por data_envio DESC
    // Invertemos para o gráfico exibir da esquerda para a direita (cronológico)
    const dadosOrdenados = [...listaDados].sort((a, b) => 
      new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime()
    );

    const labels = dadosOrdenados.map(d => this.formatarLabelPorBucket(d.data_envio, bucket));
    const valores = dadosOrdenados.map(d => d.valor);

    if (this.chart) this.chart.destroy();

    // Estilização baseada no conceito selecionado
    const configEstilo = this.getConfiguracaoVisual(bucket);

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: configEstilo.label,
          data: valores,
          borderColor: configEstilo.cor,
          backgroundColor: `${configEstilo.cor}22`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: bucket === 'minute' ? 0 : 3 // Remove pontos em dados densos
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxTicksLimit: 10 } },
          y: { beginAtZero: false }
        },
        plugins: {
          tooltip: { intersect: false, mode: 'index' }
        }
      }
    });
  }

  private formatarLabelPorBucket(dataStr: string, bucket: string): string {
    const data = new Date(dataStr);
    switch (bucket) {
      case 'day': 
        return data.toLocaleDateString('pt-BR'); // Ex: 20/05/2024
      case 'hour': 
        return data.getHours() + ':00'; // Ex: 14:00
      default: 
        return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  private getConfiguracaoVisual(bucket: string) {
    const mapas = {
      'minute': { cor: '#17a2b8', label: 'Tempo Real (Minutos)' },
      'hour': { cor: '#28a745', label: 'Consumo por Hora' },
      'day': { cor: '#6f42c1', label: 'Histórico Diário' }
    };
    return mapas[bucket as keyof typeof mapas] || mapas['hour'];
  }

  carregarInfra() {
    this.http.get<InfraStatus>(`${this.API_BASE}/infra/status`).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro infra:', err)
    });
  }
}