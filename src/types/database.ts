export type UserRole = "admin" | "socio" | "coach" | "box_admin";
export type AccountStatus = "pendiente_pago" | "activo" | "inactivo";
export type PlanTipo = "mensual_fijo" | "convenio_externo";
export type MembresiaEstado = "vigente" | "vencida" | "cancelada";
export type MetodoAsignacion = "automatico" | "manual";
export type ClaseEstado = "programada" | "cancelada";
export type ReservaEstado = "confirmada" | "cancelada" | "asistio" | "no_asistio";
export type PrUnidad = "kg" | "lbs" | "reps" | "segundos" | "metros";
export type ObjetivoEstado = "en_proceso" | "completado" | "pausado" | "cancelado";
export type SkillEstado = "en_proceso" | "logrado" | "dominado";
export type RecordTipo = "pr" | "rm";

export type BoxStatus = "active" | "inactive" | "trial";
export type BoxPlan = "free" | "basic" | "pro" | "enterprise";

export interface Box {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  status: BoxStatus;
  plan: BoxPlan;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  nombre_completo: string;
  telefono: string | null;
  foto_url: string | null;
  bio: string | null;
  rol: UserRole;
  estado_cuenta: AccountStatus;
  box_id?: string;
  is_super_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  nombre: string;
  tipo: PlanTipo;
  duracion_dias: number;
  precio: number | null;
  activo: boolean;
  box_id: string;
  created_at: string;
}

export interface Membresia {
  id: string;
  usuario_id: string;
  plan_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: MembresiaEstado;
  metodo_asignacion: MetodoAsignacion;
  notas: string | null;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface MembresiaActual extends Membresia {
  plan_nombre: string;
  plan_tipo: PlanTipo;
  plan_precio: number | null;
}

export interface Clase {
  id: string;
  nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  coach_id: string | null;
  entrenamiento: string | null;
  estado: ClaseEstado;
  created_at: string;
  updated_at: string;
  coach_nombre?: string;
  coach_foto_url?: string | null;
  coach_bio?: string | null;
  cupo_ocupado?: number;
}

export interface Reserva {
  id: string;
  clase_id: string;
  usuario_id: string;
  fecha_reserva: string;
  estado: ReservaEstado;
  created_at: string;
  clase?: Clase;
  profile?: Profile;
}

export interface AlertaMembresia {
  profile_id: string;
  nombre_completo: string;
  telefono: string | null;
  user_id: string;
  plan_nombre: string | null;
  fecha_fin: string | null;
  tipo_alerta: "vencida" | "por_vencer" | "ok";
}

export interface AtletaPrMarca {
  id: string;
  usuario_id: string;
  ejercicio: string;
  record_tipo: RecordTipo;
  rm_reps: number | null;
  valor: number;
  unidad: PrUnidad;
  fecha: string;
  notas: string | null;
  created_at: string;
}

export interface AtletaSkill {
  id: string;
  usuario_id: string;
  skill: string;
  estado: SkillEstado;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtletaSkillHistorial {
  id: string;
  skill_id: string;
  usuario_id: string;
  estado_anterior: SkillEstado | null;
  estado_nuevo: SkillEstado;
  notas: string | null;
  created_at: string;
}

export interface AtletaObjetivo {
  id: string;
  usuario_id: string;
  nombre: string;
  estado: ObjetivoEstado;
  progreso_pct: number;
  fecha_objetivo: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaseScoreTipo =
  | "tiempo"
  | "peso"
  | "reps"
  | "rondas"
  | "cals"
  | "otro";

export interface ClaseScore {
  id: string;
  clase_id: string;
  usuario_id: string;
  reserva_id: string | null;
  score_display: string;
  score_tipo: ClaseScoreTipo;
  valor_numerico: number | null;
  rx: boolean;
  sin_score: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, "id" | "nombre_completo" | "foto_url">;
}

export type AthleticLevel = "beginner" | "intermediate" | "advanced" | "rx";

export type RankingEventType =
  | "attendance"
  | "streak"
  | "wod_position"
  | "evolution"
  | "achievement";

export type RankingAwardType =
  | "champion"
  | "top3"
  | "athlete_of_month"
  | "most_evolution"
  | "longest_streak"
  | "most_consistent";

export interface RankingConfig {
  box_id: string;
  enabled: boolean;
  attendance_points: number;
  streak_bonuses: Record<string, number>;
  position_points_table: number[];
  position_points_floor: number;
  position_points_linear_drop: number;
  evolution_bonuses: { small: number; medium: number; large: number };
  achievement_points: Record<string, number>;
  min_attendances_to_rank: number;
  min_points_to_rank: number;
  /** Puntos extra al registrar score en RX (Scaled = puntos de posición normales). */
  rx_bonus_points: number;
  tagline: string;
  updated_at: string;
}

export interface RankingPointEvent {
  id: string;
  box_id: string;
  usuario_id: string;
  month_key: string;
  fecha: string;
  clase_id: string | null;
  reserva_id: string | null;
  event_type: RankingEventType;
  points: number;
  metadata: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
}

export interface RankingMonthlyAward {
  id: string;
  box_id: string;
  month_key: string;
  category: AthleticLevel | null;
  award_type: RankingAwardType;
  usuario_id: string;
  points: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AtletaPerfilDeportivo {
  usuario_id: string;
  peso_corporal_kg: number | null;
  estatura_cm: number | null;
  anos_entrenando: number | null;
  modalidad_favorita: string | null;
  notas: string | null;
  fecha_nacimiento: string | null;
  disciplina: string | null;
  nivel_deportivo: AthleticLevel | null;
  frase_legacy: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      boxes: { Row: Box; Insert: Partial<Box>; Update: Partial<Box> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      planes: { Row: Plan; Insert: Partial<Plan>; Update: Partial<Plan> };
      membresias: { Row: Membresia; Insert: Partial<Membresia>; Update: Partial<Membresia> };
      clases: { Row: Clase; Insert: Partial<Clase>; Update: Partial<Clase> };
      reservas: { Row: Reserva; Insert: Partial<Reserva>; Update: Partial<Reserva> };
      atleta_pr_marcas: {
        Row: AtletaPrMarca;
        Insert: Partial<AtletaPrMarca>;
        Update: Partial<AtletaPrMarca>;
      };
      atleta_skills: {
        Row: AtletaSkill;
        Insert: Partial<AtletaSkill>;
        Update: Partial<AtletaSkill>;
      };
      atleta_skill_historial: {
        Row: AtletaSkillHistorial;
        Insert: Partial<AtletaSkillHistorial>;
        Update: Partial<AtletaSkillHistorial>;
      };
      atleta_objetivos: {
        Row: AtletaObjetivo;
        Insert: Partial<AtletaObjetivo>;
        Update: Partial<AtletaObjetivo>;
      };
      atleta_perfil_deportivo: {
        Row: AtletaPerfilDeportivo;
        Insert: Partial<AtletaPerfilDeportivo>;
        Update: Partial<AtletaPerfilDeportivo>;
      };
      clase_scores: {
        Row: ClaseScore;
        Insert: Partial<ClaseScore>;
        Update: Partial<ClaseScore>;
      };
      ranking_config: {
        Row: RankingConfig;
        Insert: Partial<RankingConfig>;
        Update: Partial<RankingConfig>;
      };
      ranking_point_events: {
        Row: RankingPointEvent;
        Insert: Partial<RankingPointEvent>;
        Update: Partial<RankingPointEvent>;
      };
      ranking_monthly_awards: {
        Row: RankingMonthlyAward;
        Insert: Partial<RankingMonthlyAward>;
        Update: Partial<RankingMonthlyAward>;
      };
    };
  };
}
