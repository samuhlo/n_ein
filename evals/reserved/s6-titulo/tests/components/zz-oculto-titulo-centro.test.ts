/** Aceptación oculta S6 (banco de n_ein): el título de «Los cursos del centro» muestra cuántos hay. Fixtures copiados de cursos-del-centro.test.ts en 4d66007. */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { AvisoPanel, CursoPanel } from '../../app/composables/use-panel-academia'

const CURSO_SIN_PROFESOR = 'aaf4b483-4dc8-4267-a096-fdabbe11b96b'
const CURSO_SIN_PROGRAMACION = '1584e1d3-c2b1-4b62-8c99-385488191be1'
const CURSO_SIN_AVISOS = '5c0a2f2e-8f2b-4c1e-9c3a-8a9f2b1e6d10'

const CURSO_A: CursoPanel = {
  id: CURSO_SIN_PROFESOR,
  nombre: 'SMR - Administración de sistemas',
  certificadoCodigo: 'IFCT0210',
  horas: 480,
  fechaInicio: '2026-09-24',
  fechaFin: '2026-12-20',
  modulos: { asignados: 3, total: 6 },
}

const CURSO_B: CursoPanel = {
  id: CURSO_SIN_PROGRAMACION,
  nombre: 'DAM - Desarrollo de aplicaciones',
  certificadoCodigo: 'IFCT0309',
  horas: 600,
  fechaInicio: '2026-10-01',
  fechaFin: '2027-02-15',
  modulos: { asignados: 6, total: 6 },
}

const CURSO_C: CursoPanel = {
  id: CURSO_SIN_AVISOS,
  nombre: 'ADGD - Gestión administrativa',
  certificadoCodigo: 'ADGD0308',
  horas: 350,
  fechaInicio: '2026-11-01',
  fechaFin: '2027-03-01',
  modulos: { asignados: 4, total: 4 },
}

const AVISOS: AvisoPanel[] = [
  { tipo: 'modulos-sin-profesor', cursoId: CURSO_SIN_PROFESOR, cursoNombre: CURSO_A.nombre, certificadoCodigo: CURSO_A.certificadoCodigo, sinProfesor: 3 },
  { tipo: 'sin-programacion', cursoId: CURSO_SIN_PROGRAMACION, cursoNombre: CURSO_B.nombre, certificadoCodigo: CURSO_B.certificadoCodigo, fechaInicio: '2026-10-01', diasParaInicio: 5 },
]

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null })

async function montar(cursos: CursoPanel[]) {
  const CursosDelCentro = (await import('../../app/components/academia/CursosDelCentro.vue')).default
  wrapper = mount(CursosDelCentro, { props: { cursos, avisos: AVISOS } })
  return wrapper
}

describe('S6 oculto · título con el número de cursos', () => {
  it('con cursos, el título dice cuántos hay', async () => {
    const w = await montar([CURSO_A, CURSO_B, CURSO_C])
    expect(w.find('h2').text().replace(/\s+/g, ' ').trim()).toBe('Los cursos del centro (3)')
  })

  it('con un curso, también lo cuenta', async () => {
    const w = await montar([CURSO_A])
    expect(w.find('h2').text().replace(/\s+/g, ' ').trim()).toBe('Los cursos del centro (1)')
  })

  it('sin cursos, el título se queda como estaba y sigue el aviso de vacío', async () => {
    const w = await montar([])
    expect(w.find('h2').text().replace(/\s+/g, ' ').trim()).toBe('Los cursos del centro')
    expect(w.text()).toContain('Todavía no hay cursos en el centro')
  })

  it('la tabla y su caption no cambian', async () => {
    const w = await montar([CURSO_A, CURSO_B])
    expect(w.find('caption').text()).toContain('Los cursos del centro')
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
})
