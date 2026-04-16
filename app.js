// ===== MQTT CONFIG =====
const options = {
    username: "Penetas_telur",
    password: "Farming123?",
    connectTimeout: 4000,
    clientId: "web_" + Math.random().toString(16).substr(2, 8),
};

const client = mqtt.connect(
    "wss://a518f7d82e9445599e1da781533eff86.s1.eu.hivemq.cloud:8884/mqtt",
    options
);

// ===== CHART =====
const ctx = document.getElementById('tempChart');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Suhu',
            data: [],
            borderWidth: 2,
            tension: 0.3
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: false
            }
        }
    }
});

// ===== CONNECT =====
client.on("connect", () => {
    document.getElementById("status").innerText = "MQTT Connected";

    client.subscribe("inkubator/#");
});

// ===== UPDATE STATUS =====
function updateStatus(id, value, isFan = false) {
    const el = document.getElementById(id);

    el.innerText = value;

    if (value === "ON") {
        el.classList.add("on");
        el.classList.remove("off");

        if (isFan) el.classList.add("spin");
    } else {
        el.classList.add("off");
        el.classList.remove("on");

        if (isFan) el.classList.remove("spin");
    }
}

// ===== MESSAGE =====
client.on("message", (topic, message) => {
    const val = message.toString();

    if (topic === "inkubator/suhu") {
        document.getElementById("status").innerText = "Online";

        // update chart
        chart.data.labels.push("");
        chart.data.datasets[0].data.push(parseFloat(val));

        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update();
    }

    if (topic === "inkubator/lampu")
        updateStatus("lampu", val);

    if (topic === "inkubator/kipas")
        updateStatus("kipas", val, true);

    if (topic === "inkubator/low")
        document.getElementById("lowVal").innerText = val;

    if (topic === "inkubator/high")
        document.getElementById("highVal").innerText = val;
});

// ===== SEND =====
function kirimLow() {
    const v = document.getElementById("setLow").value;
    client.publish("inkubator/set/low", v);
}

function kirimHigh() {
    const v = document.getElementById("setHigh").value;
    client.publish("inkubator/set/high", v);
}