export type UserRole = "admin" | "socio" | "coach";
export type AccountStatus = "pendiente_pago" | "activo" | "inactivo";
export type PlanTipo = "mensual_fijo" | "convenio_externo";
export type MembresiaEstado = "vigente" | "vencida" | "cancelada";
export type MetodoAsignacion = "automatico" | "manual";
export type ClaseEstado = "programada" | "cancelada";
export type ReservaEstado = "confirmada" | "cancelada" | "asistio" | "no_asistio";

export interface Profile {
  id: string;
  user_id: string;
  nombre_completo: string;
  telefono: string | null;
  foto_url: string | null;
  bio: string | null;
  rol: UserRole;
  estado_cuenta: AccountStatus;
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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      planes: { Row: Plan; Insert: Partial<Plan>; Update: Partial<Plan> };
      membresias: { Row: Membresia; Insert: Partial<Membresia>; Update: Partial<Membresia> };
      clases: { Row: Clase; Insert: Partial<Clase>; Update: Partial<Clase> };
      reservas: { Row: Reserva; Insert: Partial<Reserva>; Update: Partial<Reserva> };
    };
  };
}
