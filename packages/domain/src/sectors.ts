/**
 * Plain-language sectors for users who do not know CPV codes. Choosing a sector only
 * *suggests* CPV codes and keywords; the user can review and edit every suggestion.
 * All codes are real CPV 2008 entries (see db/data/cpv-2008.tsv).
 */
import type { ContractType } from "./tenders.ts";

export interface Sector {
  id: string;
  label: string;
  description: string;
  cpvCodes: readonly string[];
  keywords: readonly string[];
  contractTypes: readonly ContractType[];
}

export const SECTORS: readonly Sector[] = [
  {
    id: "construccion",
    label: "Construcción y obra civil",
    description: "Edificación, reformas, urbanización, pavimentación",
    cpvCodes: ["45200000", "45210000", "45233000", "45400000"],
    keywords: ["obras", "rehabilitación", "urbanización", "pavimentación", "reforma"],
    contractTypes: ["works"],
  },
  {
    id: "instalaciones",
    label: "Instalaciones en edificios",
    description: "Electricidad, fontanería, climatización",
    cpvCodes: ["45300000", "45310000", "45330000", "45331000", "51000000"],
    keywords: ["instalación eléctrica", "fontanería", "climatización", "calefacción"],
    contractTypes: ["works", "services"],
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento y reparaciones",
    description: "Mantenimiento de edificios, equipos e instalaciones",
    cpvCodes: ["50000000", "50700000", "50710000"],
    keywords: ["mantenimiento", "reparación", "conservación"],
    contractTypes: ["services"],
  },
  {
    id: "limpieza",
    label: "Limpieza",
    description: "Limpieza de edificios, oficinas y espacios públicos",
    cpvCodes: ["90910000", "90911200", "90919200", "90600000"],
    keywords: ["limpieza"],
    contractTypes: ["services"],
  },
  {
    id: "jardineria",
    label: "Jardinería y zonas verdes",
    description: "Mantenimiento de parques, poda, arbolado",
    cpvCodes: ["77310000", "77311000", "77340000"],
    keywords: ["jardinería", "zonas verdes", "poda", "arbolado"],
    contractTypes: ["services"],
  },
  {
    id: "alumbrado_energia",
    label: "Alumbrado y energía",
    description: "Alumbrado público, suministro eléctrico, iluminación",
    cpvCodes: ["34928500", "50232100", "31500000", "09310000"],
    keywords: ["alumbrado", "iluminación", "energía", "eficiencia energética"],
    contractTypes: ["works", "supplies", "services"],
  },
  {
    id: "tic",
    label: "Informática y tecnología",
    description: "Software, desarrollo, soporte, equipos informáticos",
    cpvCodes: ["72000000", "72260000", "48000000", "30200000", "64200000"],
    keywords: ["software", "informático", "aplicación", "plataforma", "licencias"],
    contractTypes: ["services", "supplies"],
  },
  {
    id: "ingenieria",
    label: "Arquitectura e ingeniería",
    description: "Redacción de proyectos, dirección de obra, asistencia técnica",
    cpvCodes: ["71000000", "71200000", "71300000", "71500000"],
    keywords: ["redacción de proyecto", "dirección de obra", "asistencia técnica"],
    contractTypes: ["services"],
  },
  {
    id: "consultoria",
    label: "Consultoría y asesoría",
    description: "Gestión, jurídica, contable, auditoría",
    cpvCodes: ["79400000", "79410000", "79100000", "79200000"],
    keywords: ["consultoría", "asesoramiento", "auditoría"],
    contractTypes: ["services"],
  },
  {
    id: "formacion",
    label: "Formación",
    description: "Cursos, formación profesional y para el empleo",
    cpvCodes: ["80500000", "80530000"],
    keywords: ["formación", "cursos"],
    contractTypes: ["services"],
  },
  {
    id: "comunicacion_eventos",
    label: "Comunicación, publicidad y eventos",
    description: "Campañas, marketing, organización de eventos, imprenta",
    cpvCodes: ["79340000", "79341000", "79952000", "79800000"],
    keywords: ["publicidad", "comunicación", "eventos", "campaña"],
    contractTypes: ["services"],
  },
  {
    id: "seguridad",
    label: "Seguridad y vigilancia",
    description: "Vigilancia, auxiliares de control, conserjería",
    cpvCodes: ["79710000", "79713000", "98341130"],
    keywords: ["vigilancia", "seguridad", "conserjería"],
    contractTypes: ["services"],
  },
  {
    id: "residuos",
    label: "Residuos y medio ambiente",
    description: "Recogida y transporte de residuos, saneamiento",
    cpvCodes: ["90500000", "90511000", "90512000"],
    keywords: ["residuos", "recogida", "reciclaje"],
    contractTypes: ["services"],
  },
  {
    id: "transporte",
    label: "Transporte y vehículos",
    description: "Transporte de personas, flotas, mantenimiento de vehículos",
    cpvCodes: ["60000000", "60100000", "34100000", "50110000"],
    keywords: ["transporte", "vehículos", "autobús"],
    contractTypes: ["services", "supplies"],
  },
  {
    id: "alimentacion",
    label: "Alimentación y catering",
    description: "Comedores, cáterin, suministro de alimentos",
    cpvCodes: ["55300000", "55320000", "55520000", "15000000"],
    keywords: ["comedor", "catering", "alimentos", "comidas"],
    contractTypes: ["services", "supplies"],
  },
  {
    id: "sanitario",
    label: "Material sanitario y farmacia",
    description: "Equipamiento médico, productos sanitarios y farmacéuticos",
    cpvCodes: ["33000000", "33100000", "33600000", "38000000"],
    keywords: ["sanitario", "médico", "hospital"],
    contractTypes: ["supplies"],
  },
  {
    id: "social",
    label: "Servicios sociales",
    description: "Ayuda a domicilio, atención a personas",
    cpvCodes: ["85300000", "85310000"],
    keywords: ["ayuda a domicilio", "atención", "asistencia social"],
    contractTypes: ["services"],
  },
  {
    id: "oficina_mobiliario",
    label: "Material de oficina y mobiliario",
    description: "Papelería, mobiliario, impresos",
    cpvCodes: ["30190000", "30192000", "39100000", "39130000", "22000000"],
    keywords: ["mobiliario", "material de oficina", "papelería"],
    contractTypes: ["supplies"],
  },
  {
    id: "textil",
    label: "Vestuario y uniformes",
    description: "Ropa de trabajo, uniformes, EPIs",
    cpvCodes: ["18100000", "18110000"],
    keywords: ["vestuario", "uniformes", "ropa de trabajo"],
    contractTypes: ["supplies"],
  },
  {
    id: "seguros",
    label: "Seguros",
    description: "Pólizas de responsabilidad civil, flotas, patrimonio",
    cpvCodes: ["66510000"],
    keywords: ["seguro", "póliza"],
    contractTypes: ["services"],
  },
];

const BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

export function sectorById(id: string): Sector | undefined {
  return BY_ID.get(id);
}
