import { api } from './cliente.ts'
export interface EmpresaDominio { nit: string; nombre: string; dominios: string[] }
export const listarEmpresasDominios = (signal?: AbortSignal) => api<{ empresas: EmpresaDominio[] }>('/empresas-dominios', { signal })
export const guardarEmpresaDominio = (datos: EmpresaDominio, editar: boolean) =>
 api<EmpresaDominio>(editar ? `/empresas-dominios/${datos.nit}` : '/empresas-dominios', { method: editar ? 'PUT' : 'POST', body: JSON.stringify(datos) })
export const eliminarEmpresaDominio = (nit: string) => api<void>(`/empresas-dominios/${nit}`, { method: 'DELETE' })
