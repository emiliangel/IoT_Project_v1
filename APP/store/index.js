//Definiciones
export const state = () => ({
    auth:null,    
    devices: [],
    selectedDevice: {},
    notifications: []
});

// Updates vars
export const mutations  = {
    setAuth (state, auth) {
        state.auth = auth;
    },

    setNotifications (state, notifications) {
        state.notifications = notifications;
    },

    setDevices (state, devices)  {
        state.devices = devices;
    },

    setSelectedDevices(state, device){
        state.selectedDevice = device;
    }
}

//Actions
export const actions = {
    readToken({ commit }) {
        let auth = null;

        if (process.client) {
        try {
            auth = JSON.parse(localStorage.getItem('auth'));
        } catch (error) {
            console.log(error);
        }
        }

        commit('setAuth', auth);
    },

    getDevices () {
        const axiosHeader = {
            headers: {
                token: this.state.auth.token,
                //token: state.auth?.token // ver bien cuando usar esto, pero con la linea anterior funciona
            }
        }   
        this.$axios.get ("/device", axiosHeader)
        .then (res => {
            //Loop array to commit device selected
            res.data.data.forEach((device, index) => {
                if (device.selected){
                    this.commit("setSelectedDevices", device);
                    $nuxt.$emit('selectedDeviceIndex', index);

                }

            });
            console.log ("log1:", res.data.data);
            this.commit ("setDevices", res.data.data)
            })
    },

    getNotifications() {
        const axiosHeader = {
            headers: {
                token: this.state.auth.token
            }
        };

        this.$axios.get("/notifications", axiosHeader)
        .then(res => {
            //console.log("testing stroe", res.data.data);
            this.commit("setNotifications", res.data.data)
        }).catch (error => {
            console.log(error)
        })
    }
}






