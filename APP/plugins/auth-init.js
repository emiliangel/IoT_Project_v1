// plugins/auth-init.js
// Este plugin se ejecutará automáticamente por Nuxt en el lado del cliente.
export default async ({ store }) => {
  // Despachamos la acción readToken para que lea el auth desde localStorage
  // y actualice el store de Vuex. Al usar 'await', garantizamos que
  // el estado se actualice antes de que otros componentes/middlewares lo usen.
  if (process.client) {
    await store.dispatch('readToken');
  }
};