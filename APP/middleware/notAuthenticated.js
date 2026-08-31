// If user does not have a token, we send it to login
export default async function ({store, redirect}) {

    await store.dispatch('readToken');
    //console.log ("auth:", !store.state.auth )
    if(store.state.auth) {
        return redirect ("/dashboard")
    }
    
}