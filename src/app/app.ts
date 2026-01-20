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

  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  isLoading = signal<boolean>(false);
  dataInicioManual = signal<string>('');
  dataFimManual = signal<string>('');
  chart: Chart | null = null;

  ngOnInit() {
    this.carregarInfra();
    this.exibirTempoReal();
  }

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
        console.error('Erro na API:', err);
        this.isLoading.set(false);
      }
    });
  }

  // MÉTODO QUE ESTAVA FALTANDO NO SEU BUILD:
  exibirUltimos90Dias() {
    const hoje = new Date();
    const noventaDiasAtras = new Date();
    noventaDiasAtras.setDate(hoje.getDate() - 90);
    
    this.buscarDados(
      noventaDiasAtras.toISOString().split('T')[0],
      hoje.toISOString().split('T')[0],
      'day'
    );
  }

  exibirTempoReal() {
    const hoje = new Date().toISOString().split('T')[0];
    this.buscarDados(hoje, hoje, 'minute');
  }

  buscarPorMes(event: any) {
    const mesRef = event.target.value; // YYYY-MM
    if (!mesRef) return;
    const data = new Date(mesRef + "-01T12:00:00");
    const primeiro = new Date(data.getFullYear(), data.getMonth(), 1).toISOString().split('T')[0];
    const ultimo = new Date(data.getFullYear(), data.getMonth() + 1, 0).toISOString().split('T')[0];
    this.buscarDados(primeiro, ultimo, 'hour');
  }

  buscarPorRangeManual() {
    const inicio = this.dataInicioManual();
    const fim = this.dataFimManual();
    if (!inicio || !fim) return;

    const diff = (new Date(fim).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24);
    let bucket = diff > 31 ? 'day' : (diff > 1 ? 'hour' : 'minute');
    this.buscarDados(inicio, fim, bucket);
  }

  setInicio(event: any) { this.dataInicioManual.set(event.target.value); }
  setFim(event: any) { this.dataFimManual.set(event.target.value); }

  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!this.elementoGrafico || !listaDados.length) return;
    const ordenados = [...listaDados].sort((a, b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime());
    const labels = ordenados.map(d => this.formatarLabel(d.data_envio, bucket));
    const valores = ordenados.map(d => d.valor);

    if (this.chart) this.chart.destroy();
    const estilo = this.getEstilo(bucket);

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: estilo.label,
          data: valores,
          borderColor: estilo.cor,
          backgroundColor: `${estilo.cor}22`,
          fill: true,
          tension: 0.4,
          pointRadius: bucket === 'minute' ? 0 : 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { tooltip: { intersect: false, mode: 'index' } }
      }
    });
  }

  private formatarLabel(dataStr: string, bucket: string): string {
    const d = new Date(dataStr);
    if (bucket === 'day') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (bucket === 'hour') return d.getHours() + ':00';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  private getEstilo(bucket: string) {
    const config = {
      'minute': { cor: '#17a2b8', label: 'Minutos' },
      'hour': { cor: '#28a745', label: 'Horas' },
      'day': { cor: '#6f42c1', label: 'Dias' }
    };
    return config[bucket as keyof typeof config] || config['hour'];
  }

  carregarInfra() {
    this.http.get<InfraStatus>(`${this.API_BASE}/infra/status`).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro infra:', err)
    });
  }
}