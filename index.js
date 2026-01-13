import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  TELNYX_API_KEY,
  TELNYX_AGENT_CONNECTION_ID,
  TELNYX_AGENT_SIP_URI,
  TELNYX_FROM_NUMBER,
} = process.env;

const HOLD_URL =
  "https://fmeonuvmlopkutbjejlo.supabase.co/storage/v1/object/public/Ringtone/minimalistic-for-design-201447.mp3";

function sendTeXML(res, xml) {
  res.set("Content-Type", "text/xml");
  res.send(xml);
}

app.get("/", (_, res) => res.status(200).send("OK"));

/**
 * OFFICE MENU
 */
app.get("/office/menu", (req, res) => {
  sendTeXML(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="https://vantage-lane-ringtone.onrender.com/office/router" method="POST" numDigits="1" timeout="6" validDigits="1209">
    <Say voice="Polly.Amy-Neural">
      Thank you for calling Vantage Lane London — premium chauffeur and concierge.
      Press 1 for bookings and reservations.
      Press 2 for drivers and operations.
      Press 0 for immediate assistance.
      Press 9 to repeat this menu.
    </Say>
  </Gather>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/menu</Redirect>
</Response>`
  );
});

/**
 * HOLD MUSIC LOOP
 */
app.all("/office/hold", (req, res) => {
  sendTeXML(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${HOLD_URL}</Play>
  <Pause length="1"/>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/hold</Redirect>
</Response>`
  );
});

/**
 * ROUTER: enqueue caller + call agent immediately (Zoiper)
 */
app.all("/office/router", async (req, res) => {
  const digits = String(req.body?.Digits ?? req.query?.Digits ?? "").trim();

  if (digits === "9" || digits === "") {
    return sendTeXML(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/menu</Redirect>
</Response>`
    );
  }

  // call agent immediately (fire-and-forget)
  try {
    await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection_id: TELNYX_AGENT_CONNECTION_ID,
        from: TELNYX_FROM_NUMBER,
        to: TELNYX_AGENT_SIP_URI,
      }),
    });
  } catch (e) {
    // ignore
  }

  sendTeXML(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Please hold while I connect you.</Say>
  <Enqueue waitUrl="https://vantage-lane-ringtone.onrender.com/office/hold" waitUrlMethod="GET">VL-OFFICE-QUEUE</Enqueue>
</Response>`
  );
});

/**
 * AGENT BRIDGE: agent joins queue to pick up caller
 */
app.get("/agent/bridge", (req, res) => {
  sendTeXML(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Connecting you to the next caller.</Say>
  <Dial timeout="40">
    <Queue>VL-OFFICE-QUEUE</Queue>
  </Dial>
  <Say voice="Polly.Amy-Neural">No caller is waiting right now. Goodbye.</Say>
  <Hangup/>
</Response>`
  );
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Listening on", port));
