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
    // Para o gráfico de linha, precisamos do cronológico (esquerda -> direita)
    const dadosInvertidos = [...listaDados].reverse();
    
    // Configuração do Eixo X baseada no conceito selecionado
    const labels = dadosInvertidos.map(d => {
      const data = new Date(d.data_envio);
      if (bucket === 'day') {
        // Visão Geral / Range Mensal: Mostra "dia/mês"
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
      // Tempo Real / Média por Hora: Mostra "hora:minuto"
      return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    const valores = dadosInvertidos.map(d => d.valor);

    // Destruir instância anterior para liberar memória e evitar sobreposição visual
    if (this.chart) {
      this.chart.destroy();
    }

    // Identidade Visual Dinâmica (Diferencia visualmente o tipo de dado)
    const corPrincipal = bucket === 'day' ? '#28a745' : (bucket === 'hour' ? '#6f42c1' : '#007bff');

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: bucket === 'day' ? 'Média Diária (Bucket)' : 'Valor Telemetria',
          data: valores,
          borderColor: corPrincipal,
          backgroundColor: `${corPrincipal}1A`, // 10% de opacidade
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
            title: { 
              display: true, 
              text: bucket === 'day' ? 'Eixo: Dias (Análise de Range)' : 'Eixo: Tempo (Agregação Bucket)' 
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