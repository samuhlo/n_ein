/**
 * Aceptación oculta S3a (banco de n_ein): dar de alta un centro se rechaza a
 * quien ya tiene cursos propios o módulos asignados, sin escribir nada.
 * La base falsa responde por tabla (`from`, `db.query`) y entiende recuentos,
 * para no depender de cómo consulte cada variante.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  filas: {} as Record<string, unknown[]>,
  inserts: [] as unknown[],
  batches: [] as unknown[][],
}))

vi.mock('../../server/utils/session', () => ({
  requireUser: (...args: unknown[]) => mocks.requireUser(...args),
  requireVerifiedUser: (...args: unknown[]) => mocks.requireUser(...args),
}))

vi.mock('../../server/db/index', async () => {
  const { getTableName, is, SQL, Table } = await import('drizzle-orm')
  const nombre = (tabla: unknown) => (is(tabla, Table) ? getTableName(tabla as never) : String(tabla))
  const esAgregado = (valor: unknown) => is(valor, SQL) || (typeof valor === 'object' && valor !== null && 'queryChunks' in valor)
  const consulta = (campos?: Record<string, unknown>) => {
    let tabla = ''
    const chain: Record<string, unknown> = {}
    for (const metodo of ['where', 'limit', 'orderBy', 'groupBy', 'innerJoin', 'leftJoin', 'rightJoin', 'offset', 'for']) chain[metodo] = () => chain
    chain.from = (t: unknown) => { tabla = nombre(t); return chain }
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      const filas = mocks.filas[tabla] ?? []
      // Un recuento devuelve una fila con el número; una lista, las filas.
      const salida = campos && Object.values(campos).some(esAgregado)
        ? [Object.fromEntries(Object.keys(campos).map((k) => [k, filas.length]))]
        : filas
      return Promise.resolve(salida).then(resolve, reject)
    }
    return chain
  }
  const query = new Proxy({}, {
    get: (_target, clave: string) => {
      const tabla = { cursos: 'cursos', asignacionesModulo: 'asignaciones_modulo', member: 'member', municipios: 'municipios' }[clave] ?? clave
      return {
        findFirst: async () => (mocks.filas[tabla] ?? [])[0],
        findMany: async () => mocks.filas[tabla] ?? [],
      }
    },
  })
  return {
    db: {
      select: (campos?: Record<string, unknown>) => consulta(campos),
      selectDistinct: (campos?: Record<string, unknown>) => consulta(campos),
      $count: async (tabla: unknown) => (mocks.filas[nombre(tabla)] ?? []).length,
      // SQL directo: hay actividad si alguna tabla nombrada en la consulta tiene filas. Cualquier
      // columna de la fila devuelta (exists, count, alias propio) responde con ese resultado.
      execute: async (consulta: unknown) => {
        const tablas: string[] = []
        const recorrer = (v: unknown): void => {
          if (is(v, Table)) tablas.push(nombre(v))
          else if (v && typeof v === 'object' && 'queryChunks' in v) for (const c of (v as { queryChunks: unknown[] }).queryChunks) recorrer(c)
          else if (v && typeof v === 'object' && 'table' in v && is((v as { table: unknown }).table, Table)) tablas.push(nombre((v as { table: unknown }).table))
        }
        recorrer(consulta)
        const hay = tablas.some((t) => t !== 'municipios' && (mocks.filas[t] ?? []).length > 0)
        const fila = new Proxy({}, { get: (_o, k) => (k === 'then' ? undefined : hay ? 1 : 0) })
        return Object.assign([fila], { rows: [fila] })
      },
      query,
      insert: () => ({
        values: (values: unknown) => {
          mocks.inserts.push(values)
          return { then: (resolve: (value?: unknown) => unknown) => Promise.resolve().then(resolve) }
        },
      }),
      batch: (operations: unknown[]) => {
        mocks.batches.push(operations)
        return Promise.resolve([])
      },
    },
  }
})

;(globalThis as Record<string, unknown>).defineEventHandler = (handler: unknown) => handler
;(globalThis as Record<string, unknown>).createError = (options: Record<string, unknown>) =>
  Object.assign(new Error(String(options.message)), options)
const readBodyMock = vi.fn()
;(globalThis as Record<string, unknown>).readBody = readBodyMock

type Handler = (event: unknown) => Promise<unknown>
const crear = (await import('../../server/api/academia/index.post')).default as Handler
const { traducirErrorAlta } = await import('../../app/composables/use-academia-alta')

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', emailVerified: true }
const BODY = { nombre: 'Academia Norte', domicilio: 'Rúa Árbore 12', cp: '', municipio: 'Lugo', municipioId: '27028', provincia: 'Lugo' }
const CURSO_PROPIO = { id: 'curso-1', ownerUserId: USER.id, organizationId: null, certificadoCodigo: 'IFCD0110' }
const ASIGNACION = { id: 'asig-1', cursoId: 'curso-9', userId: USER.id, moduloCodigo: 'MF0001', moduloId: 'mod-1' }

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue(USER)
  mocks.filas = { municipios: [{ id: '27028' }] }
  mocks.inserts.length = 0
  mocks.batches.length = 0
  readBodyMock.mockReset().mockResolvedValue(BODY)
})

async function rechazo(): Promise<{ statusCode?: number } | null> {
  return crear({}).then(() => null, (error: { statusCode?: number }) => error)
}

describe('S3 oculto · alta de centro', () => {
  it('rechaza a quien ya tiene cursos propios, sin escribir', async () => {
    mocks.filas.cursos = [CURSO_PROPIO]
    const error = await rechazo()
    expect(error?.statusCode).toBeGreaterThanOrEqual(400)
    expect(error?.statusCode).toBeLessThan(500)
    expect(mocks.batches).toHaveLength(0)
    expect(mocks.inserts).toHaveLength(0)
  })

  it('rechaza a quien ya tiene módulos asignados, sin escribir', async () => {
    mocks.filas.asignaciones_modulo = [ASIGNACION]
    const error = await rechazo()
    expect(error?.statusCode).toBeGreaterThanOrEqual(400)
    expect(error?.statusCode).toBeLessThan(500)
    expect(mocks.batches).toHaveLength(0)
    expect(mocks.inserts).toHaveLength(0)
  })

  it('sin cursos ni módulos, el alta sigue creando el centro', async () => {
    const respuesta = await crear({}) as { academia?: Record<string, unknown> }
    expect(respuesta.academia).toMatchObject({ nombre: 'Academia Norte' })
    expect(mocks.batches).toHaveLength(1)
  })
})

// Diagnóstico añadido el 7 de octubre: el rechazo debe llegar al consumidor
// como regla de cuenta, no como una avería que invite a reintentar sin cambios.
describe('S3 · explicación del rechazo en el consumidor real', () => {
  it.each(['cursos', 'asignaciones_modulo'])('explica el rechazo por %s', async (tabla) => {
    mocks.filas[tabla] = [tabla === 'cursos' ? CURSO_PROPIO : ASIGNACION]
    const error = await rechazo() as { statusCode?: number; data?: unknown } | null
    expect(error).not.toBeNull()
    const mensaje = traducirErrorAlta({ data: { statusCode: error?.statusCode, data: error?.data } })
    expect(mensaje).toMatch(/cuenta/i)
    expect(mensaje).toMatch(/curso|módulo|docente/i)
    expect(mensaje).not.toMatch(/fallo de conexión|fallo.*servidor|unos segundos/i)
  })
})
