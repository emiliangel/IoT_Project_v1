// If user does not have a token, we send it to login
export default function ({store, redirect}) {

    store.dispatch('readToken');
    
    if (!store.state.auth){
       // console.log("test")
        return redirect ("/login")
    }

}