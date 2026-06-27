/**
 * Generadores deterministas para demo mensual Athron Ranking.
 */

export type AthleticLevel = "beginner" | "intermediate" | "advanced" | "rx";
export type ScoreTipo = "tiempo" | "peso" | "reps" | "rondas" | "cals" | "otro";

export type ScoreDef =
  | { sin_score: true; notas?: string }
  | {
      display: string;
      tipo: ScoreTipo;
      valor: number | null;
      rx: boolean;
      notas?: string;
    };

export type AthleteProfile = {
  email: string;
  nombre: string;
  memDays: number;
  level: AthleticLevel;
  birthYear: number;
  /** 0–1 probabilidad de asistir un día laboral */
  attendanceRate: number;
  /** 0–1 probabilidad de marcar RX al puntuar */
  rxRate: number;
  /** Tier de rendimiento 0–100 */
  skillBase: number;
  /** Narrativa para consola */
  story: string;
  /** Preferencia de horario para la demo */
  sessionBias: "morning" | "evening" | "flex";
};

/** Mañana 6:00–9:00 · 1 h por clase */
export const MORNING_SLOTS = [
  { start: "06:00", end: "07:00" },
  { start: "07:00", end: "08:00" },
  { start: "08:00", end: "09:00" },
] as const;

/** Tarde 17:00–21:00 · 1 h por clase (última termina 21:00) */
export const EVENING_SLOTS = [
  { start: "17:00", end: "18:00" },
  { start: "18:00", end: "19:00" },
  { start: "19:00", end: "20:00" },
  { start: "20:00", end: "21:00" },
] as const;

export const CLASSES_PER_DAY =
  MORNING_SLOTS.length + EVENING_SLOTS.length;

export const WOD_ROTATION = [
  "WOD Matutino",
  "Halterofilia",
  "Hyrox",
  "Gimnasia",
  "WOD Tarde",
] as const;

export const DEMO_ATHLETES: AthleteProfile[] = [
  {
    email: "sofia.lopez@email.com",
    nombre: "Sofía López",
    memDays: 22,
    level: "beginner",
    birthYear: 1998,
    attendanceRate: 0.92,
    rxRate: 0.15,
    skillBase: 52,
    story: "Campeona Beginner — constancia + rachas",
    sessionBias: "morning",
  },
  {
    email: "jorge.martinez@email.com",
    nombre: "Jorge Martínez",
    memDays: 18,
    level: "beginner",
    birthYear: 1995,
    attendanceRate: 0.65,
    rxRate: 0.1,
    skillBase: 44,
    story: "Beginner en progreso — evolución gradual",
    sessionBias: "morning",
  },
  {
    email: "andres.vargas@email.com",
    nombre: "Andrés Vargas",
    memDays: 12,
    level: "beginner",
    birthYear: 2000,
    attendanceRate: 0.78,
    rxRate: 0.2,
    skillBase: 48,
    story: "Beginner constante — sube en WOD Matutino",
    sessionBias: "flex",
  },
  {
    email: "lucia.herrera@email.com",
    nombre: "Lucía Herrera",
    memDays: 25,
    level: "intermediate",
    birthYear: 1990,
    attendanceRate: 0.85,
    rxRate: 0.55,
    skillBase: 68,
    story: "Intermediate — RX selectivo + PRs",
    sessionBias: "morning",
  },
  {
    email: "elena.castro@email.com",
    nombre: "Elena Castro",
    memDays: 15,
    level: "intermediate",
    birthYear: 1992,
    attendanceRate: 0.8,
    rxRate: 0.25,
    skillBase: 62,
    story: "Intermediate — scaled sólido",
    sessionBias: "flex",
  },
  {
    email: "valeria.nunez@email.com",
    nombre: "Valeria Núñez",
    memDays: -5,
    level: "intermediate",
    birthYear: 1993,
    attendanceRate: 0.5,
    rxRate: 0.3,
    skillBase: 58,
    story: "Membresía vencida — datos parciales del mes",
    sessionBias: "evening",
  },
  {
    email: "pablo.silva@email.com",
    nombre: "Pablo Silva",
    memDays: 20,
    level: "advanced",
    birthYear: 1987,
    attendanceRate: 0.72,
    rxRate: 0.7,
    skillBase: 78,
    story: "Advanced — potencia + bonus RX",
    sessionBias: "evening",
  },
  {
    email: "ricardo.pena@email.com",
    nombre: "Ricardo Peña",
    memDays: 10,
    level: "advanced",
    birthYear: 1989,
    attendanceRate: 0.88,
    rxRate: 0.75,
    skillBase: 82,
    story: "Advanced — mayor evolución del mes",
    sessionBias: "evening",
  },
  {
    email: "miguel.ramos@email.com",
    nombre: "Miguel Ramos",
    memDays: 28,
    level: "rx",
    birthYear: 1988,
    attendanceRate: 0.9,
    rxRate: 0.95,
    skillBase: 92,
    story: "Campeón RX — casi siempre #1 + bonus RX",
    sessionBias: "evening",
  },
  {
    email: "carla.mendez@email.com",
    nombre: "Carla Méndez",
    memDays: 25,
    level: "rx",
    birthYear: 1991,
    attendanceRate: 0.82,
    rxRate: 0.6,
    skillBase: 85,
    story: "RX — mix scaled/RX, racha fuerte",
    sessionBias: "evening",
  },
];

export function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function monthBounds(timezone: string, today: string) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd, monthKey: monthStart.slice(0, 7) };
}

export function listWeekdayDates(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const end = new Date(to + "T12:00:00");
  const cur = new Date(y, m - 1, d);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 6) {
      out.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function wodScoreType(nombre: string): ScoreTipo {
  if (nombre.includes("Halter")) return "peso";
  if (nombre.includes("Hyrox")) return "cals";
  if (nombre.includes("Gimnasia")) return "reps";
  if (nombre.includes("Tarde")) return "rondas";
  return "tiempo";
}

function formatTime(totalSec: number): string {
  const sec = Math.max(1, Math.round(totalSec));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatRounds(value: number): string {
  const r = Math.floor(value);
  const reps = Math.round((value - r) * 100);
  return `${r}+${reps}`;
}

export function generateScore(
  athlete: AthleteProfile,
  wodName: string,
  tipo: ScoreTipo,
  attempt: number,
  supportsCals: boolean
): ScoreDef {
  const rx = seededRandom(`${athlete.email}:rx:${wodName}:${attempt}`) < athlete.rxRate;
  const improve = Math.min(attempt * 0.04, 0.2);
  const tier = athlete.skillBase + improve * 20;
  const jitter = seededRandom(`${athlete.email}:j:${wodName}:${attempt}`) * 8 - 4;
  const perf = Math.max(20, Math.min(98, tier + jitter));

  if (
    athlete.email === "jorge.martinez@email.com" &&
    wodName === "Gimnasia" &&
    attempt === 1
  ) {
    return { sin_score: true, notas: "Clase técnica — sin score" };
  }

  if (
    athlete.email === "carla.mendez@email.com" &&
    wodName === "Hyrox" &&
    attempt === 2
  ) {
    return { sin_score: true, notas: "Sin ergómetro" };
  }

  switch (tipo) {
    case "tiempo": {
      const sec = Math.round(960 - perf * 5.5);
      return {
        display: formatTime(sec),
        tipo: "tiempo",
        valor: sec,
        rx,
      };
    }
    case "peso": {
      const kg = Math.round(80 + perf * 2.4);
      return { display: String(kg), tipo: "peso", valor: kg, rx };
    }
    case "cals": {
      const cals = Math.round(180 + perf * 2.2);
      const useCals = supportsCals;
      return {
        display: String(cals),
        tipo: useCals ? "cals" : "reps",
        valor: cals,
        rx,
      };
    }
    case "reps": {
      const reps = Math.round(70 + perf * 1.1);
      return { display: String(reps), tipo: "reps", valor: reps, rx };
    }
    case "rondas": {
      const r = 4 + Math.floor(perf / 18);
      const extra = Math.round((perf % 18) * 1.2);
      const val = r + extra / 100;
      return {
        display: formatRounds(val),
        tipo: "rondas",
        valor: val,
        rx,
      };
    }
    default:
      return { sin_score: true, notas: "Demo" };
  }
}

export function wodNameForSlot(
  dayIndex: number,
  slotIndex: number,
  session: "morning" | "evening"
): string {
  const morningNames = ["WOD Matutino", "Halterofilia", "Gimnasia"];
  const eveningNames = ["Hyrox", "WOD Tarde", "Gimnasia", "Halterofilia"];
  const names = session === "morning" ? morningNames : eveningNames;
  const rotate = (dayIndex + slotIndex) % names.length;
  return names[rotate] ?? WOD_ROTATION[dayIndex % WOD_ROTATION.length];
}

export type AttendanceDecision = "asistio" | "no_asistio" | "confirmada" | "skip";

export function decideAttendance(
  athlete: AthleteProfile,
  fecha: string,
  today: string,
  session: "morning" | "evening"
): AttendanceDecision {
  if (fecha > today) return "confirmada";

  const bias = athlete.sessionBias ?? "flex";
  const sessionRoll = seededRandom(`${athlete.email}:sess:${fecha}:${session}`);
  if (bias === "morning" && session === "evening" && sessionRoll > 0.15) {
    return "skip";
  }
  if (bias === "evening" && session === "morning" && sessionRoll > 0.15) {
    return "skip";
  }

  const r = seededRandom(`${athlete.email}:att:${fecha}:${session}`);

  if (athlete.memDays < 0) {
    const day = parseInt(fecha.slice(8, 10), 10);
    if (day > 12) return "skip";
  }

  if (r > athlete.attendanceRate) return "skip";
  if (r > athlete.attendanceRate - 0.08) return "no_asistio";
  return "asistio";
}
