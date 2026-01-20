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

  // Signals para estado reativo e filtros manuais
  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  isLoading = signal<boolean>(false);
  dataInicioManual = signal<string>('');
  dataFimManual = signal<string>('');
  chart: Chart | null = null;

  ngOnInit() {
    this.carregarInfra();
    // Inicialização: Busca dados do dia de hoje (Janeiro de 2026)
    this.exibirHoje();
  }

  /**
   * MÉTODO PRINCIPAL: Chamada à API Lambda
   * Gerencia a comunicação com o RDS enviando os parâmetros de particionamento
   */
  buscarDados(inicio?: string, fim?: string, bucket: string = 'hour') {
    this.isLoading.set(true);

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

  /**
   * LÓGICA DE FILTROS DINÂMICOS (BOTÕES RÁPIDOS)
   */

  exibirHoje() {
    // Definido como 20/01/2026 para alinhar com seus dados de teste
    const hoje = '2026-01-20'; 
    this.buscarDados(hoje, hoje, 'minute');
  }

  exibirMesAtual() {
    // Range para o mês de Janeiro completo
    this.buscarDados('2026-01-01', '2026-01-31', 'hour');
  }

  exibirUltimos90Dias() {
    // Range estendido para testar o cruzamento de múltiplas partições mensais
    this.buscarDados('2026-01-01', '2026-04-30', 'day');
  }

  /**
   * FILTRO POR RANGE MANUAL (Ex: 25/01 até 25/05)
   */
  buscarPorRangeManual() {
    const inicio = this.dataInicioManual();
    const fim = this.dataFimManual();

    if (!inicio || !fim) {
      alert('Selecione ambas as datas para filtrar o período.');
      return;
    }

    // Calcula a distância entre as datas para sugerir o grão (Time Bucket) ideal
    const diffInMs = new Date(fim).getTime() - new Date(inicio).getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    let bucket = 'minute';
    if (diffInDays > 1 && diffInDays <= 7) bucket = 'hour';
    if (diffInDays > 7) bucket = 'day';

    this.buscarDados(inicio, fim, bucket);
  }

  // Handlers para os inputs de data do HTML
  setInicio(event: any) { this.dataInicioManual.set(event.target.value); }
  setFim(event: any) { this.dataFimManual.set(event.target.value); }

  /**
   * RENDERIZAÇÃO E FORMATAÇÃO DO GRÁFICO
   */
  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!this.elementoGrafico || !listaDados.length) return;

    // Ordenação cronológica para garantir a continuidade da linha
    const dadosOrdenados = [...listaDados].sort((a, b) => 
      new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime()
    );

    const labels = dadosOrdenados.map(d => this.formatarLabelPorBucket(d.data_envio, bucket));
    const valores = dadosOrdenados.map(d => d.valor);

    if (this.chart) this.chart.destroy();

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
          pointRadius: bucket === 'minute' ? 0 : 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxTicksLimit: 12 } },
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
      case 'day': return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      case 'hour': return data.getHours() + ':00';
      default: return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  private getConfiguracaoVisual(bucket: string) {
    const mapas = {
      'minute': { cor: '#17a2b8', label: 'Dados Granulares (Minuto)' },
      'hour': { cor: '#28a745', label: 'Média por Hora' },
      'day': { cor: '#6f42c1', label: 'Histórico por Dia' }
    };
    return mapas[bucket as keyof typeof mapas] || mapas['hour'];
  }

  carregarInfra() {
    this.http.get<InfraStatus>(`${this.API_BASE}/infra/status`).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao buscar status da infra:', err)
    });
  }
}