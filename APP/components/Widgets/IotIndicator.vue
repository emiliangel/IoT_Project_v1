<template>
    <Card>
        <div slot="header">
            <h4 class="card-title"> {{config.selectedDevice.name}} - {{ config.variableFullName }}</h4>
            
        </div>
          <!-- ver esto no entendí , tampoco funcionó font-size-->  
        <i class="fa fa-2x" :class="[config.icon, getIconColorClass(config.class)]"></i>

    </Card>
  
</template>

<script>

    export default {
        props: ['config'],
        data () {
            return { 
                topic: "",
                value: true,   
            }

        },

        methods: {
            processReceiverData(data){
                try{
                    console.log ("received");
                    console.log(data);
                    this.value = data.value;                
                }catch (error){
                    console.log("Error processing received data in IoT indicator", error);
                }
            },

            getIconColorClass(){
                value:true

                if (!this.value){
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
            }
        },

        watch: {
            config: {
                immediate: true,
                deep: true,
                handler() {
                    setTimeout(() => { 
                        this.value = false;
                        this.$nuxt.$off(this.topic, this.processReceiverData)
                        this.topic = this.config.userId + "/" + this.config.selectedDevice.dId + "/" + this.config.variable + "/sdata";
                        console.log("Esto es en el IoT indicator", this.topic);
                        this.$nuxt.$on(this.topic, this.processReceiverData)
                    }, 300);
                }
            }
        },
        mounted (){
            const topic = this.config.userId + "/" + this.config.selectedDevice.dId + "/" + this.config.variable + "/sdata";
            console.log("Esto es en el IoT indicator", topic);
            this.$nuxt.$on(topic, this.processReceiverData)
             
        },

        beforeDestroy () {
            this.$nuxt.$off(this.topic)
            // en el commit 101, esto quedó mal, estaba mal el tópico
        }   // ver esta función, xq parece que se comporta igual sin esta función


    }

</script>
