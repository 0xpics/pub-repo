export interface InfraStatus {
  motor: string;
  particoes_ativas: { child_table: string }[];
  agendamento_manutencao: {
    jobname: string;
    schedule: string;
    active: boolean;
  };
  custo_infra: string;
}