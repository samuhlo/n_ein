/** Aceptación oculta S2 (banco de n_ein): con curso, el cliente pide el Anexo III sin mandar la planificación. Montaje copiado de curso-panel-documentos.test.ts en 4d66007. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Anexo4Modulo } from '../../app/composables/useAnexo4'
import type { FilaQueFalta } from '../../app/composables/use-curso-panel'
import type { ResultadoPlanificacion } from '../../app/types'

// BLINDAJE -> mismo motivo que anexo-iii-preview.test.ts: el `useState`
// global de tests/setup.ts no sirve para poblar `cursoActivoId`.
const sharedCursoActivoId = ref<string | null>('curso-activo-1')

vi.mock('../../app/composables/use-cursos', () => ({
  useCursos: () => ({ cursoActivoId: sharedCursoActivoId }),
}))

const CursoPanelDocumentos = (await import('../../app/components/CursoPanelDocumentos.vue')).default

const Stubs = {
  UiCard: { template: '<div class="ui-card-stub"><slot /></div>' },
  UiBadge: { template: '<span class="ui-badge-stub">{{ label }}</span>', props: ['label', 'size', 'color'] },
  UiIcon: { template: '<span class="ui-icon-stub" />', props: ['name'] },
  UiButton: {
    template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  UiDownloadMenu: {
    template: '<div class="download-menu-stub"><button data-testid="docx" :disabled="disabled" @click="onDocx">DOCX</button><button data-testid="pdf" :disabled="disabled" @click="onPdf">PDF</button></div>',
    props: ['onDocx', 'onPdf', 'disabled'],
  },
  AnexoIIIPreview: {
    template: '<div class="anexo3-preview-stub" :data-solo-consulta="soloConsulta" />',
    props: { planificacion: {}, calendar: {}, horario: {}, horaInicio: {}, horaFin: {}, soloConsulta: Boolean },
  },
}

function makeModulos(): Anexo4Modulo[] {
  return [
    { id: 'uuid-mf1', codigo: 'MF1', nombre: 'M1', horas: 100, objetivoGeneral: null, ucAsociada: { codigo: null, nombre: null }, ambitos: [
      { scope: 'mf', moduloId: 'uuid-mf1', unidadFormativaId: null, codigo: 'MF1', nombre: 'M1', horas: 100, capacidades: [], contenidos: [], programacion: { metodologia: 'a', actividades: 'b', recursos: 'c' } },
    ] },
    { id: 'uuid-mf2', codigo: 'MF2', nombre: 'M2', horas: 100, objetivoGeneral: null, ucAsociada: { codigo: null, nombre: null }, ambitos: [
      { scope: 'mf', moduloId: 'uuid-mf2', unidadFormativaId: null, codigo: 'MF2', nombre: 'M2', horas: 100, capacidades: [], contenidos: [], programacion: { metodologia: '', actividades: '', recursos: '' } },
    ] },
  ]
}

function makePlanificacion(): ResultadoPlanificacion {
  return {
    certificado: { codigo: 'IFCD0110', nombre: 'Cert', nivel: '2', familia: 'F', realDecreto: 'RD', totalHoras: 200, modulos: [] },
    centro: { codigo: 'C1', nombre: 'Centro', domicilio: 'C/ 1', cp: '27001', municipio: 'Lugo', provincia: 'Lugo' },
    fechaInicio: '2027-01-18',
    fechaFin: '2027-03-10',
    diasLectivos: 40,
    modulos: [],
    modulosComplementarios: [],
    modulosEmpresa: [],
    avisos: [],
  } as unknown as ResultadoPlanificacion
}

function fila(estado: FilaQueFalta['estado'], descripcion = 'texto'): FilaQueFalta {
  return { id: 'programacion', titulo: 't', anexo: 'Anexo IV', descripcion, estado }
}

function mountComponent(props: Record<string, unknown> = {}): VueWrapper {
  return mount(CursoPanelDocumentos, {
    props: {
      papel: 'dueño',
      codigosDocente: [],
      codigo: 'IFCD0110',
      modulos: makeModulos(),
      filaProgramacion: fila('A medias'),
      filaEvaluacion: fila('Bloqueado'),
      filaInforme: fila('Bloqueado'),
      planificacion: makePlanificacion(),
      centro: null,
      fechaInicio: null,
      fechaFin: null,
      ...props,
    },
    global: { stubs: Stubs },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  ;(globalThis as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue(new Blob(['x']))
  ;(globalThis as unknown as { URL: typeof URL }).URL.createObjectURL = vi.fn().mockReturnValue('blob:x')
  ;(globalThis as unknown as { URL: typeof URL }).URL.revokeObjectURL = vi.fn()
  sharedCursoActivoId.value = 'curso-activo-1'
})

const CLAVES_DE_PLANIFICACION = ['modulos', 'modulosEmpresa', 'modulosComplementarios', 'fechaInicio', 'fechaFin', 'centro', 'diasLectivos']

describe('S2 oculto · el panel no manda la planificación cuando hay curso', () => {
  it.each(['docx', 'pdf'])('Anexo III en %s: solo el cursoId identifica lo que se exporta', async (formato) => {
    // La descarga puede ir por `$fetch` o por `$fetch.raw` (para leer cabeceras): se vigilan las dos.
    const fetchMock = (globalThis as { $fetch: ReturnType<typeof vi.fn> & { raw?: ReturnType<typeof vi.fn> } }).$fetch
    fetchMock.raw = vi.fn().mockResolvedValue({ _data: new Blob(['x']), headers: new Headers() })
    const wrapper = mountComponent()
    await wrapper.findAll(`[data-testid="${formato}"]`)[0]!.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const llamadas = [...fetchMock.mock.calls, ...fetchMock.raw.mock.calls]
    const llamada = llamadas.find(([url]) => url === `/api/export/${formato}`)
    expect(llamada).toBeDefined()
    const body = (llamada![1] as { body: Record<string, unknown> }).body
    expect(body.cursoId).toBe('curso-activo-1')
    for (const clave of CLAVES_DE_PLANIFICACION) expect(body).not.toHaveProperty(clave)
  })
})
