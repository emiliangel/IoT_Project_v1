<template>
    <Card>
        <div slot="header">
            <h4 class="card-title"> {{config.selectedDevice.name}} - {{ config.variableFullName }}</h4>

        </div>
          <!-- ver esto no entendí , tampoco funcionó font-size-->
        <i class="fa fa-2x" :class="[config.icon, getIconColorClass()]"></i>
        <base-button @click= "sendValue()" :type="config.class" class="mb-3 pull-right" size="lg">Add</base-button>

    </Card>

</template>

<script>

    export default {
        props: ['config'],
        data () {
            return {
                sending: false,
                /*config:{
                   userId: 'userid',
                   selectedDevice: {

                    name: "Office",
                    dId: "8888",
                    templateName: "Power Sensor",
                    templateId:"21423423423423423",
                    saverRule: true,
                   },

                   variableFullName: "Pump",
                   variable: "var1",
                   icon:"fa-sun",
                   column:'col-6',
                   widget: 'indicator',
                   class: 'success',
                   message: "{'fanstatus': 'stop'}",

                },*/


            }

        },

        mounted (){  
        },

        methods: {

            sendValue() {
                this.sending = true;
                
                setTimeout (() => {
                    this.sending = false;
                }, 1000);

                const toSend = {
                    //As this topic goes from platform to devices it finishes in actdata
                     topic:this.config.userId + "/" + this.config.selectedDevice.dId + "/" + this.config.variable + "/actdata",
                     msg: {
                        value: this.config.message
                     }

                };

                console.log(toSend);
                this.$nuxt.$emit('mqtt-sender', toSend)



            },

            getIconColorClass(){
                value:true

                if (!this.sending){
                    return "text-dark"
                }

                if (this.config.class == "success"){
                    return "text-success"
                }


                if (this.config.class == "primary"){
                    return "text-success"
                }


                if (this.config.class == "warning"){
                    return "text-success"
                }

                if (this.config.class == "danger"){
                    return "text-danger"
                }
            },

        },
    }

</script>
