import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js'; 
import { InfraStatus } from './infra.model';

// Registra os componentes necessários do Chart.js
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

  // Signals para reatividade e estado da aplicação
  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  chart: any;

  ngOnInit() {
    this.carregarInfra();
    // Inicialização padrão: Tempo Real (últimos minutos)
    this.chamarApi(undefined, undefined, 'minute');
  }

  /**
   * Chamada principal à API Lambda
   * Gerencia Filtro por Data, Range e Time Bucket via Query Strings
   */
  chamarApi(inicio?: string, fim?: string, agrupamento: string = 'minute') {
    
    // Tratamento para evitar que strings vazias de inputs de data quebrem a lógica
    if (inicio === "") inicio = undefined;
    if (fim === "") fim = undefined;

    // URL base do seu API Gateway
    let url = `https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data?bucket=${agrupamento}`;

    // Adição dinâmica de parâmetros para Filtro por Range
    if (inicio) url += `&start_date=${inicio}`;
    if (fim) url += `&end_date=${fim}`;

    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.dados.set(res);
        this.renderizarGrafico(res, agrupamento);
      },
      error: (err) => {
        console.error('Erro na chamada da telemetria:', err);
      }
    });
  }

  /**
   * Renderiza o gráfico utilizando Chart.js
   * Implementa a lógica visual de diferenciação entre Tempo Real e Agrupado
   */
  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!listaDados || listaDados.length === 0 || !this.elementoGrafico) return;

    // Invertemos o array pois o RDS retorna DESC (mais novo primeiro)
    const dadosInvertidos = [...listaDados].reverse();
    
    // LÓGICA DE EIXO X INTELIGENTE (Detecta cruzamento de dias)
    const labels = dadosInvertidos.map(d => {
      const data = new Date(d.data_envio);
      
      // Caso 1: Visão Estratégica Mensal (Apenas data)
      if (bucket === 'day') {
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }

      // Caso 2: Detecção de Período Multi-dia
      // Compara a data do primeiro e do último registro do set atual
      const dataInicio = new Date(dadosInvertidos[0].data_envio).toLocaleDateString();
      const dataFim = new Date(dadosInvertidos[dadosInvertidos.length - 1].data_envio).toLocaleDateString();
      const isMultiDia = dataInicio !== dataFim;

      if (isMultiDia) {
        // Retorna "DD/MM HH:MM" para evitar confusão no gráfico
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + 
               ' ' + 
               data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      // Caso 3: Dentro do mesmo dia (Apenas horário)
      return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    const valores = dadosInvertidos.map(d => d.valor);

    // Destruir instância anterior para evitar bugs de renderização
    if (this.chart) {
      this.chart.destroy();
    }

    // Identidade Visual Dinâmica
    const corPrincipal = bucket === 'day' ? '#28a745' : (bucket === 'hour' ? '#6f42c1' : '#007bff');

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: bucket === 'day' ? 'Média Diária (Bucket)' : 'Valor Telemetria',
          data: valores,
          borderColor: corPrincipal,
          backgroundColor: `${corPrincipal}1A`, 
          borderWidth: 3,
          fill: true,
          tension: 0.3, 
          pointRadius: bucket === 'day' ? 5 : 2,
          pointBackgroundColor: corPrincipal
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          y: { 
            beginAtZero: false, 
            grid: { color: '#f0f0f0' },
            title: { display: true, text: 'Valor do Sensor' }
          },
          x: { 
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12
            },
            title: { 
              display: true, 
              text: bucket === 'day' ? 'Análise por Dia' : 'Linha do Tempo (Bucket)' 
            }
          }
        }
      }
    });
  }

  /**
   * Monitoramento de Infraestrutura: Carrega metadados do RDS e partições
   */
  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar metadados de infra:', err)
    });
  }
}