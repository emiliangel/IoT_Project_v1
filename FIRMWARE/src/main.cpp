#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include "IoTicosSplitter.h"


#define led 2

String dId = "11111";
String webhook_pass = "Q5KB7YgcoB";
// On webhook_endpoint and on mqtt_server, set the public ip of the server, and on local network, set the local ip of the server (the host in this case)
String webhook_endpoint = "http://192.168.0.102:3001/api/getdevicescredentials";
const char* mqtt_server = "192.168.0.102";


// Configuración WiFi
const char* wifi_ssid = "TPlink";
const char* wifi_password = "RESPBhab07";

// Configuración MQTT (broker público de prueba)
const int mqtt_port = 1883;

// Clientes
WiFiClient espClient;
PubSubClient client(espClient);
IoTicosSplitter splitter;
DynamicJsonDocument mqtt_data_doc (1024);




void  process_sensors();
void  process_actuators();

//Template

bool get_mqtt_credentials();
void check_mqtt_connection();
void send_data_to_broker();
void process_incoming_msg(String topic, String incoming);
void callback(char* topic, byte* payload, unsigned int length);
void clear();
void print_stats();
bool reconnect();
void toggle_generic_var();



// Variables de control
long lastReconnectAttemp = 0;
long varsLastSend[20] = {};
unsigned long lastCycle = 0;
unsigned long lastToggle = 0;
bool generic_state = false;



void setup() {
    Serial.begin(921600);
    delay(1000);
    clear();

    Serial.println("\n\n=== INICIANDO TEST MÍNIMO ===\n");
    pinMode(led, OUTPUT);
    Serial.println("LED pin configurado como OUTPUT");


    // Conectar WiFi
    Serial.print("Conectando WiFi");
    WiFi.begin(wifi_ssid, wifi_password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nWiFi Conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    // Configurar MQTT
    client.setServer(mqtt_server, mqtt_port);
    
    client.setCallback(callback);
    Serial.println("\n=== CONFIGURACIÓN COMPLETA ===");
    Serial.println("Entrando al loop principal...\n");

    //get_mqtt_credentials();
    delay(4000);

}

void loop() {

      // put your main code here, to run repeatedly:
  
  check_mqtt_connection();
}

int prev_temp = 0;
int prev_hum = 0;

void send_data_to_broker(){

  long now = millis(); //Current time

  for(int i = 0; i < mqtt_data_doc["variables"].size(); i++){

    if (mqtt_data_doc["variables"][i]["variableType"] == "output"){
      continue;
    }

    int freq = mqtt_data_doc["variables"][i]["variableSendFreq"];

    //If has passed the freq time from the last record
    if (/*now - varsLastSend[i] > freq * 1000*/ true){ // It multiplies by 1000 times to reescale
      varsLastSend[i] = millis();

      // The topic is retreived from mqtt_data_doc(http request at other function)
      String str_root_topic = mqtt_data_doc["topic"];
      String str_variable = mqtt_data_doc["variables"][i]["variable"];
      String topic = str_root_topic + str_variable + "/sdata";

      String toSend = "";
      serializeJson(mqtt_data_doc["variables"][i]["last"], toSend); //Serialize
     
     
      Serial.print("");
      client.publish(topic.c_str(), toSend.c_str()); // Publish to topic

      //STATISTICS

      long counter = mqtt_data_doc["variables"][i]["last"]["counter"];
      counter++;
      mqtt_data_doc["variables"][i]["counter"] = counter;
      
      Serial.println(topic);
      Serial.println("Data sent to broker:" + toSend);
    }

  }

     
}



void process_sensors() {

  //get temp simulation
  int temp = random(1, 60);
  mqtt_data_doc["variables"][0]["last"]["value"] = temp;

  //save temp?
  int dif = temp - prev_temp;
  if (dif < 0) {dif *= -1;}


  if (dif >= 40) {
    mqtt_data_doc["variables"][0]["last"]["save"] = 1; //Set to one if saving on MongoDB is desired
  }else{
    mqtt_data_doc["variables"][0]["last"]["save"] = 1;
  }

  prev_temp = temp;

  //get humidity simulation
  int hum = random (1, 50);
  mqtt_data_doc["variables"][1]["last"]["value"] = hum;

    //save hum?
  dif = hum - prev_hum;
  if (dif < 0) {dif *= -1;}

  if (dif >= 20) {
    mqtt_data_doc["variables"][1]["last"]["save"] = 1; //Set to one if saving on MongoDB is desired
  }else{
    mqtt_data_doc["variables"][1]["last"]["save"] = 1;
  }

  prev_hum = hum;

  //get led status

  Serial.println("LED STATUS: " + String(digitalRead(led)));
  // variables[4] (generic var) is now driven by toggle_generic_var() every 2 s



}

void process_actuators(){


  if (mqtt_data_doc["variables"][2]["last"]["value"] == "true"){

    digitalWrite(led, HIGH);
    mqtt_data_doc["variables"][2]["last"]["value"] = ""; //This is to avoid that the led turns on and off repeatedly, because if the value is true, it will turn on, but if it is not set to false, it will remain true, and it will turn on again in the next loop iteration
    varsLastSend[4] = 0; //This is to send the led status immediately, because if the value is true, it will turn on, but if it is not set to false, it will remain true, and it will turn on again in the next loop iteration, so it will send the status of the led immediately, because if it is not set to false, it will remain true, and it will turn on again in the next loop iteration

  }else if(mqtt_data_doc["variables"][3]["last"]["value"] == "false"){

    digitalWrite(led, LOW);
    mqtt_data_doc["variables"][3]["last"]["value"] = ""; //This is to avoid that the led turns on and off repeatedly, because if the value is false, it will turn off, but if it is not set to true, it will remain false, and it will turn off again in the next loop iteration
    varsLastSend[4] = 0; //This is to send the led status immediately, because if it is false, it will turn off, but if it is not set to true, it will remain false, and it will turn off again in the next loop iteration, so it will send the status of the led immediately, because if it is not set to true, it will remain false, and it will turn off again in the next loop iteration
  }
}

// TEMPLATE

String last_received_msg = "";
String last_received_topic = "";


void process_incoming_msg(String topic, String incoming){
  last_received_msg = incoming;
  last_received_topic = topic;

  String variable = splitter.split(topic, '/', 2); // It depends on the topic structure, but in this case, it is "root/variable/actdata", so the variable is in index 1
      Serial.println("Incoming message for variable: " + variable);

  for (int i = 0; i < mqtt_data_doc["variables"].size(); i++){
    String var_name = mqtt_data_doc["variables"][i]["variable"].as<String>();
    if (var_name == variable){
      Serial.println("Incoming message for variable: " + var_name);
      DynamicJsonDocument doc (256);
      deserializeJson (doc, incoming); //It deseriali zes the incoming message, and it is stored in doc variable, which is a DynamicJsonDocument
      mqtt_data_doc["variables"][i]["last"] = doc;

      long counter =  mqtt_data_doc["variables"][i]["counter"];
      counter++;
      mqtt_data_doc["variables"][i]["counter"] = counter;
    }
  }

  process_actuators();
  serializeJsonPretty(mqtt_data_doc, Serial);

}

void callback(char* topic, byte* payload, unsigned int length){

  String incoming = "";
  
  for (int i = 0; i < length; i++){
    incoming += (char)payload[i];
  }

  incoming.trim();

  process_incoming_msg(String(topic), incoming);

  //Serial.println("Message received: " + String(incoming) + " from topic: " + String(topic) + "\n");
}



bool reconnect(){ //Reconnect to backend
  if(!get_mqtt_credentials()){
    Serial.println("Error getting mqtt credentials-..... RESTARTING IN 10 SECONDS");
    delay(10000);
    ESP.restart();
  }

  //Setting up Mqtt Server

  client.setServer(mqtt_server, 1883);
  Serial.print("Trying MQTT Connection");
  String str_client_id = "device_" + dId + "_";

  String username = mqtt_data_doc["username"].as<String>();
  String password = mqtt_data_doc["password"].as<String>();
  String str_topic = mqtt_data_doc["topic"].as<String>();

  Serial.println("\n" + username);
  Serial.println("\n" + password); 

  if(client.connect(str_client_id.c_str(), username.c_str(), password.c_str())){
    Serial.print("Mqtt Client Connected :) ");
    delay(2000);
    client.subscribe((str_topic + "+/actdata").c_str());
    delay(500);


    return true;
  }else{
    Serial.print("Mqtt Client Connection Failed :( ");

  }
}

void check_mqtt_connection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("Wifi Connection failed..... RESTARTING");
    delay(15000);
    ESP.restart();
  }

  if(!client.connected()){
    Serial.print("Client not connected ");
    long now = millis();
    if (now - lastReconnectAttemp > 5000){
      lastReconnectAttemp = millis();
        if (reconnect()){
          lastReconnectAttemp = 0; //This set to zero, because if its turns disconnected out, it can reconnect automatically regardless that has passed a difference of 5 seconds between now and lastReconnecAttemp
        }
    }
  }else {
      client.loop();
      toggle_generic_var();

      // Non-blocking 5 s cycle (replaces the old delay(5000) in loop)
      if (millis() - lastCycle > 5000){
        lastCycle = millis();
        process_sensors();
        send_data_to_broker();
        serializeJsonPretty(mqtt_data_doc, Serial);
      }

      print_stats();
  }
}

// Toggles the generic variable (index 4) every 2 seconds and publishes it immediately
void toggle_generic_var(){
  if (millis() - lastToggle < 2000){
    return;
  }
  lastToggle = millis();

  generic_state = !generic_state;
  mqtt_data_doc["variables"][4]["last"]["value"] = generic_state;

  String str_root_topic = mqtt_data_doc["topic"];
  String str_variable = mqtt_data_doc["variables"][4]["variable"];
  String topic = str_root_topic + str_variable + "/sdata";

  String toSend = "";
  serializeJson(mqtt_data_doc["variables"][4]["last"], toSend);
  client.publish(topic.c_str(), toSend.c_str());

  long counter = mqtt_data_doc["variables"][4]["counter"];
  counter++;
  mqtt_data_doc["variables"][4]["counter"] = counter;
}

bool get_mqtt_credentials() {
  Serial.print("Getting MQTT Credentials from WebHook");
  delay(1000);


  String toSend = "dId=" + dId + "&password=" + webhook_pass;
  HTTPClient http;
  http.begin(webhook_endpoint); //Start POST request
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.POST(toSend);
  int response_code = http.POST(toSend);
  
  if (response_code < 0){
    Serial.print("Error Sending Post Request");
    http.end();
    return false;
  }

  if(response_code != 200){
    Serial.print("Error in response :(   e-> ");
    http.end();  
    return false;
  }

  if (response_code == 200){
    String responseBody = http.getString();
    Serial.print("Mqtt Credentials Obtained Successfully");
    deserializeJson(mqtt_data_doc, responseBody);

    String mqtt_username = mqtt_data_doc["username"];
    String mqtt_password = mqtt_data_doc["password"];
    int freq = mqtt_data_doc["variables"][1]["variableSendFreq"];
    //Serial.println("\n" + mqtt_username);
    //Serial.println("\n" + mqtt_password); //Warning, maybe, i'm doin poninter arithmetics here, and it could fail
    //Serial.println("\n");
    //Serial.println(freq);

    Serial.print("\n\n" + responseBody);
    //delay(2000);
  }

  return true;
}

void clear () {
    Serial.print("\033[2J");  // Limpia la pantalla
    Serial.print("\033[H");   // Mueve el cursor al inicio
}

long lastStats = 0;

void print_stats()
{
  long now = millis();

  if (now - lastStats > 2000)
  {
    lastStats = millis();
    clear();

    // Use \r\n so every line starts at column 0 (plain \n causes a "staircase" effect)
    Serial.print("\r\n");
    Serial.print("\r\n╔══════════════════════════╗");
    Serial.print("\r\n║       SYSTEM STATS       ║");
    Serial.print("\r\n╚══════════════════════════╝");
    Serial.print("\r\n\r\n");

    // Fixed-width columns instead of tabs so everything lines up
    Serial.printf("%-4s %-12s %-14s %-8s %-8s %s\r\n", "#", "Name", "Var", "Type", "Count", "Last V");
    Serial.println("---------------------------------------------------------------------------");

    for (int i = 0; i < mqtt_data_doc["variables"].size(); i++)
    {

      String variableFullName = mqtt_data_doc["variables"][i]["variableFullName"];
      String variable = mqtt_data_doc["variables"][i]["variable"];
      String variableType = mqtt_data_doc["variables"][i]["variableType"];
      String lastMsg = mqtt_data_doc["variables"][i]["last"];
      long counter = mqtt_data_doc["variables"][i]["counter"];

      Serial.printf("%-4d %-12s %-14s %-8s %-8ld %s\r\n",
                    i,
                    variableFullName.substring(0, 12).c_str(),
                    variable.substring(0, 14).c_str(),
                    variableType.substring(0, 8).c_str(),
                    counter,
                    lastMsg.c_str());
    }

    Serial.printf("\r\n\r\n Free RAM -> %u Bytes\r\n", ESP.getFreeHeap());

    Serial.print("\r\n Last Incomming Msg -> " + last_received_msg);
  }
}
