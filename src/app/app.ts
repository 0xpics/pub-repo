import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js'; 
import { InfraStatus } from './infra.model';

// Registra os componentes do Chart.js
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

  // Signals para reatividade
  dados = signal<any[]>([]); 
  statusInfra = signal<InfraStatus | null>(null);
  chart: any;

  ngOnInit() {
    this.carregarInfra();
    // Inicialização padrão: Tempo Real (últimos minutos)
    this.chamarApi(undefined, undefined, 'minute');
  }

  /**
   * Chama a API Lambda com suporte a Filtro de Data e Time Bucket
   * @param inicio Data inicial opcional (YYYY-MM-DD)
   * @param fim Data final opcional (YYYY-MM-DD)
   * @param agrupamento Tipo de bucket (minute, hour, day)
   */
  chamarApi(inicio?: string, fim?: string, agrupamento: string = 'minute') {
    // Montagem dinâmica da URL com query strings
    let url = `https://mympqg08a4.execute-api.us-east-1.amazonaws.com/data?bucket=${agrupamento}`;

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
   * Renderiza ou atualiza o gráfico Chart.js
   * @param listaDados Array de objetos vindos do RDS
   * @param bucket Nível de agrupamento para definir a formatação do eixo X
   */
  renderizarGrafico(listaDados: any[], bucket: string) {
    if (!listaDados || listaDados.length === 0 || !this.elementoGrafico) return;

    // Invertemos o array para a ordem cronológica correta no gráfico
    const dadosInvertidos = [...listaDados].reverse();
    
    // LÓGICA DE PESQUISA: Formatação dinâmica de datas (Eixo X)
    const labels = dadosInvertidos.map(d => {
      const data = new Date(d.data_envio);
      if (bucket === 'day') {
        // Se visualizando meses, mostra "DD/MM"
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      }
      // Se visualizando tempo real ou horas, mostra "HH:MM"
      return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });

    const valores = dadosInvertidos.map(d => d.valor);

    // Destruir instância anterior para evitar bugs de hover e renderização
    if (this.chart) {
      this.chart.destroy();
    }

    // Configurações visuais dinâmicas baseadas no modo selecionado
    const corPrincipal = bucket === 'day' ? '#28a745' : (bucket === 'hour' ? '#6f42c1' : '#007bff');

    this.chart = new Chart(this.elementoGrafico.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: bucket === 'day' ? 'Média Diária' : 'Valor da Telemetria',
          data: valores,
          borderColor: corPrincipal,
          backgroundColor: `${corPrincipal}1A`, // Cor com 10% de opacidade para o preenchimento
          borderWidth: 3,
          fill: true,
          tension: 0.3, 
          pointRadius: bucket === 'day' ? 5 : 3,
          pointBackgroundColor: corPrincipal
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false } 
        },
        scales: {
          y: { 
            beginAtZero: false, 
            grid: { color: '#eee' },
            title: { display: true, text: 'Valor do Sensor' }
          },
          x: { 
            grid: { display: false },
            title: { display: true, text: bucket === 'day' ? 'Período (Dias)' : 'Tempo (Horário)' }
          }
        }
      }
    });
  }

  /**
   * Monitoramento de Infraestrutura (Metadados do Banco)
   */
  carregarInfra() {
    const url = 'https://mympqg08a4.execute-api.us-east-1.amazonaws.com/infra/status';
    this.http.get<InfraStatus>(url).subscribe({
      next: (res) => this.statusInfra.set(res),
      error: (err) => console.error('Erro ao carregar metadados de infra:', err)
    });
  }
}