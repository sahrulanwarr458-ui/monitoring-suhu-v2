// ===== MQTT CONFIG =====
const options = {
    username: "Penetas_telur",
    password: "Farming123?",
    clientId: "web_" + Math.random().toString(16).substr(2, 8),
    reconnectPeriod: 5000,
};

const client = mqtt.connect(
    "wss://a518f7d82e9445599e1da781533eff86.s1.eu.hivemq.cloud:8884/mqtt",
    options
);

let chart;
let currentMode = "AUTO";

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    initChart();
    updateTime();
    setInterval(updateTime, 1000);

    document.getElementById("clientId").innerText = options.clientId;

    document.getElementById("autoModeBtn").onclick = () => setMode("AUTO");
    document.getElementById("manualModeBtn").onclick = () => setMode("MANUAL");

    document.getElementById("lampOnBtn").onclick = () => sendManual("lamp","ON");
    document.getElementById("lampOffBtn").onclick = () => sendManual("lamp","OFF");
});

// ===== MODE =====
function setMode(mode){
    client.publish("inkubator/mode", mode);
    updateModeUI(mode);
}

function updateModeUI(mode){
    currentMode = mode;
    document.getElementById("modeStatus").innerText = mode;
    document.getElementById("manualPanel").style.display =
        mode === "MANUAL" ? "block" : "none";
}

// ===== MANUAL =====
function sendManual(dev,val){
    if(currentMode !== "MANUAL") return alert("Mode MANUAL dulu");
    client.publish(`inkubator/manual/${dev}`, val);
}

// ===== MQTT =====
client.on("connect", ()=>{
    client.subscribe("inkubator/#");
});

client.on("message",(topic,msg)=>{
    let val = msg.toString();

    if(topic==="inkubator/suhu"){
        document.getElementById("currentTemp").innerText =
            parseFloat(val).toFixed(1);
        updateChart(parseFloat(val));
    }

    if(topic==="inkubator/lampu"){
        updateStatus("lampu",val);
    }

    if(topic==="inkubator/kipas"){ // sekarang MOTOR
        updateStatus("motor",val);
    }

    if(topic==="inkubator/low"){
        document.getElementById("lowVal").innerText =
            parseFloat(val).toFixed(1);
    }

    if(topic==="inkubator/high"){
        document.getElementById("highVal").innerText =
            parseFloat(val).toFixed(1);
    }

    if(topic==="inkubator/mode"){
        updateModeUI(val);
    }
});

// ===== UI =====
function updateStatus(id,val){
    const el = document.getElementById(id);
    val = val==="ON" ? "ON" : "OFF";

    el.innerText = val;
    el.className = "status-badge " + (val==="ON"?"on":"off");
}

// ===== CHART =====
function initChart(){
    const ctx = document.getElementById("tempChart").getContext("2d");
    chart = new Chart(ctx,{
        type:"line",
        data:{labels:[],datasets:[{data:[]}]}
    });
}

function updateChart(temp){
    const t = new Date().toLocaleTimeString();
    chart.data.labels.push(t);
    chart.data.datasets[0].data.push(temp);

    if(chart.data.labels.length>30){
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

// ===== TIME =====
function updateTime(){
    document.getElementById("currentTime").innerText =
        new Date().toLocaleString();
}
