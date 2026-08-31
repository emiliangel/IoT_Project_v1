export default function ({ $axios, store, redirect }) {

  $axios.onError(error => {

    console.log("Interceptor axios:", error);

    // Si existe respuesta y es 401
    if (error.response && error.response.status === 401 && error.response.data.error === "Invalid token") {

      console.log("TOKEN INVALIDO");

      // limpiar localStorage
      localStorage.clear();

      // limpiar vuex
      store.commit("setAuth", {});

      // redireccionar
      redirect("/login");
    }

    // IMPORTANTE
    return Promise.reject(error);
  });
}