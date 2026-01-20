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
    
    // Tratamento para o seletor manual: evita que strings vazias quebrem a URL
    if (inicio === "" || inicio === null) inicio = undefined;
    if (fim === "" || fim === null) fim = undefined;

    // URL base do seu API Gateway
    let url = `https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data?bucket=${agrupamento}`;

    // Adição dinâmica de parâmetros
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
   * Lógica do Gráfico: Ajusta labels e cores conforme o botão clicado
   */
  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!listaDados || listaDados.length === 0 || !this.elementoGrafico) return;

    // Invertemos o array pois o RDS retorna DESC (mais novo primeiro)
    const dadosInvertidos = [...listaDados].reverse();
    
    // LÓGICA DE LABELS PARA OS 3 CONCEITOS
    const labels = dadosInvertidos.map(d => {
      const data = new Date(d.data_envio);
      
      if (bucket === 'day') {
        // Caso 3: Time Bucket (Resumo Diário)
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }

      if (bucket === 'hour') {
        // Caso 2: Filtro por Range (Visualização por Hora)
        return data.toLocaleDateString('pt-BR', { day: '2-digit' }) + ' ' + 
               data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      // Caso 1: Filtro por Data ou Tempo Real (Visualização por Minuto)
      return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    const valores = dadosInvertidos.map(d => d.valor);

    // Destruir instância anterior para evitar sobreposição
    if (this.chart) {
      this.chart.destroy();
    }

    // Cores diferentes para cada conceito (Alinhado com os botões do HTML)
    const corPrincipal = bucket === 'day' ? '#6f42c1' : (bucket === 'hour' ? '#28a745' : '#17a2b8');

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: bucket === 'day' ? 'Média Diária' : 'Valor Telemetria',
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
            }
          }
        }
      }
    });
  }

  /**
   * Monitoramento de Infraestrutura: Carrega metadados do RDS
   */
  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar infra:', err)
    });
  }
}