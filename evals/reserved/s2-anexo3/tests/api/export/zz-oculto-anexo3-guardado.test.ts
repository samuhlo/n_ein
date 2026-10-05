/**
 * Aceptación oculta S2 (banco de n_ein): con curso, el Anexo III sale de la
 * planificación guardada (`config.planningSnapshot.resultado`) y no del cuerpo.
 * Se afirma sobre lo que llega a la puerta de publicación y al constructor de
 * cada formato, no sobre cómo lo implementa cada variante.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPlanningSnapshotV2, type Centro, type HoraInicio, type ResultadoPlanificacion } from '../../../shared/types/planning.types'

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  resolverContextoExportacionOpcional: vi.fn(),
  resolverContextoExportacion: vi.fn(),
  requireRuntimeAnexo3Export: vi.fn(),
  buildAnexo3Docx: vi.fn(),
  packerToBuffer: vi.fn(),
  createPdf: vi.fn(),
  getBuffer: vi.fn(),
}))

vi.mock('../../../server/utils/session', () => ({
  requireVerifiedUser: (...args: unknown[]) => mocks.requireVerifiedUser(...args),
}))
vi.mock('../../../server/utils/export/contexto', () => ({
  resolverContextoExportacionOpcional: (...args: unknown[]) => mocks.resolverContextoExportacionOpcional(...args),
  resolverContextoExportacion: (...args: unknown[]) => mocks.resolverContextoExportacion(...args),
}))
vi.mock('../../../server/utils/official-curriculum/projection-runtime', () => ({
  requireRuntimeAnexo3Export: (...args: unknown[]) => mocks.requireRuntimeAnexo3Export(...args),
}))
vi.mock('../../../server/utils/docx/buildAnexo3Docx', () => ({
  buildAnexo3Docx: (...args: unknown[]) => mocks.buildAnexo3Docx(...args),
}))
vi.mock('docx', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Packer: { toBuffer: (...args: unknown[]) => mocks.packerToBuffer(...args) },
}))
vi.mock('pdfmake', () => ({
  default: { setFonts: vi.fn(), setUrlAccessPolicy: vi.fn(), createPdf: (...args: unknown[]) => mocks.createPdf(...args) },
}))
vi.mock('pdfmake/standard-fonts/Helvetica.js', () => ({ default: {} }))

const readBodyMock = vi.fn()
const createErrorMock = vi.fn((opts: { statusCode: number; message: string; data?: unknown }) => {
  const err = new Error(opts.message) as Error & { statusCode: number; data?: unknown }
  err.statusCode = opts.statusCode
  if (opts.data !== undefined) err.data = opts.data
  return err
})
;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
;(globalThis as Record<string, unknown>).readBody = readBodyMock
;(globalThis as Record<string, unknown>).createError = createErrorMock
;(globalThis as Record<string, unknown>).setResponseHeaders = vi.fn()

type Handler = (event: unknown) => Promise<unknown>
const handlers: Record<'json' | 'docx' | 'pdf', Handler> = {
  json: (await import('../../../server/api/export/json.post')).default as Handler,
  docx: (await import('../../../server/api/export/docx.post')).default as Handler,
  pdf: (await import('../../../server/api/export/pdf.post')).default as Handler,
}

const CURSO_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const USER = { id: 'user-1', emailVerified: true }
const CENTRO = {
  codigo: 'C001', nombre: 'Centro Guardado', domicilio: 'Calle 1', cp: '27001',
  municipio: 'Lugo', municipioId: '27028', provincia: 'Lugo',
} satisfies Centro

function resultado(nombre: string): ResultadoPlanificacion {
  return {
    certificado: { codigo: 'IFCD0110', nombre, totalHoras: 560, modulos: [] },
    centro: CENTRO, fechaInicio: '2027-01-18', fechaFin: '2027-06-30', horasDiarias: 5,
    horario: 'manana', horaInicio: '09:00', diasLectivos: 100, modulos: [],
    modulosComplementarios: [], modulosEmpresa: [], avisos: [],
  }
}

async function cursoGuardado() {
  const planningSnapshot = await buildPlanningSnapshotV2({
    certificadoCodigo: 'IFCD0110', centro: CENTRO, fechaInicio: '2027-01-18', horasDiarias: 5,
    horaInicio: '09:00' as HoraInicio, horario: 'manana', complementarios: [],
    calendar: {
      regionCode: 'ES-GA', fromYear: 2027, toYear: 2027, status: 'complete',
      municipality: { id: '27028', name: 'Lugo', provinceCode: '27', provinceName: 'Lugo' },
      province: { code: '27', name: 'Lugo' }, coverageYears: [2027], missingYears: [],
      calendars: [{
        year: 2027, calendarId: '11111111-1111-4111-8111-111111111111', version: 1, status: 'complete',
        fileHash: 'a'.repeat(64), sourceUrl: 'https://example.com', sourcePublishedAt: null,
        importedAt: '2027-01-01T00:00:00Z', publisher: 'Xunta de Galicia', license: null,
      }],
      dates: { state: ['2027-01-01'], regional: [], municipal: [] }, entries: [], warnings: [],
    },
    resultado: resultado('PLAN GUARDADO'),
  })
  return {
    id: CURSO_ID, certificadoCodigo: 'IFCD0110', nombre: 'Curso', ownerUserId: USER.id,
    config: {
      certificadoCodigo: 'IFCD0110', horasTotales: 560, fechaInicio: '2027-01-18', horasDiarias: 5,
      horaInicio: '09:00', centro: CENTRO, complementarios: [], planningSnapshot,
    },
  }
}

async function contextoCon(curso: unknown) {
  const contexto = { curso, papel: 'dueño', codigosAsignados: new Set(), codigoPorModuloId: new Map() }
  mocks.resolverContextoExportacionOpcional.mockResolvedValue(contexto)
  mocks.resolverContextoExportacion.mockResolvedValue(contexto)
}

// Lo que cada formato acaba pintando: la salida en JSON, el argumento del constructor en DOCX y PDF.
function pintado(formato: 'json' | 'docx' | 'pdf', salida: unknown): string {
  if (formato === 'json') return JSON.stringify(salida)
  if (formato === 'docx') return JSON.stringify(mocks.buildAnexo3Docx.mock.calls.at(-1)?.[0])
  return JSON.stringify(mocks.createPdf.mock.calls.at(-1)?.[0])
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireVerifiedUser.mockResolvedValue(USER)
  mocks.requireRuntimeAnexo3Export.mockImplementation(async (plan: unknown) => plan)
  mocks.buildAnexo3Docx.mockReturnValue({})
  mocks.packerToBuffer.mockResolvedValue(Buffer.from('docx'))
  mocks.getBuffer.mockResolvedValue(Buffer.from('pdf'))
  mocks.createPdf.mockReturnValue({ getBuffer: mocks.getBuffer })
})

describe.each(['json', 'docx', 'pdf'] as const)('S2 oculto · /api/export/%s', (formato) => {
  it('con curso exporta la planificación guardada aunque el cuerpo traiga otra', async () => {
    await contextoCon(await cursoGuardado())
    readBodyMock.mockResolvedValue({ cursoId: CURSO_ID, ...resultado('PLAN MANIPULADO') })

    const salida = await handlers[formato]({})

    const enPuerta = JSON.stringify(mocks.requireRuntimeAnexo3Export.mock.calls.at(-1)?.[0])
    expect(enPuerta).toContain('PLAN GUARDADO')
    expect(enPuerta).not.toContain('PLAN MANIPULADO')
    expect(pintado(formato, salida)).toContain('PLAN GUARDADO')
    expect(pintado(formato, salida)).not.toContain('PLAN MANIPULADO')
  })

  it('con curso basta con mandar el cursoId', async () => {
    await contextoCon(await cursoGuardado())
    readBodyMock.mockResolvedValue({ cursoId: CURSO_ID })

    const salida = await handlers[formato]({})

    expect(pintado(formato, salida)).toContain('PLAN GUARDADO')
  })

  it('un curso sin planificación guardada válida se rechaza sin pintar el cuerpo', async () => {
    const curso = await cursoGuardado()
    await contextoCon({ ...curso, config: { ...curso.config, planningSnapshot: null } })
    readBodyMock.mockResolvedValue({ cursoId: CURSO_ID, ...resultado('PLAN MANIPULADO') })

    const error = await handlers[formato]({}).then(() => null, (e: { statusCode?: number }) => e)

    expect(error?.statusCode).toBeGreaterThanOrEqual(400)
    expect(error?.statusCode).toBeLessThan(500)
    expect(JSON.stringify(mocks.requireRuntimeAnexo3Export.mock.calls)).not.toContain('PLAN MANIPULADO')
    expect(mocks.buildAnexo3Docx).not.toHaveBeenCalled()
    expect(mocks.createPdf).not.toHaveBeenCalled()
  })

  it('sin curso sigue exportando el cuerpo del asistente', async () => {
    mocks.resolverContextoExportacionOpcional.mockResolvedValue(null)
    readBodyMock.mockResolvedValue(resultado('PLAN DEL ASISTENTE'))

    const salida = await handlers[formato]({})

    expect(pintado(formato, salida)).toContain('PLAN DEL ASISTENTE')
  })
})
