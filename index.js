const express = require("express");

const app = express();

// Telnyx posts form-encoded data (Digits etc.)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const HOLD_URL =
  "https://fmeonuvmlopkutbjejlo.supabase.co/storage/v1/object/public/Ringtone/minimalistic-for-design-201447.mp3";

// MENU: Telnyx TeXML points here for inbound calls
app.all("/menu", (req, res) => {
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="/router" method="POST" numDigits="1" timeout="6" validDigits="1209">
    <Say voice="Polly.Amy-Neural">
      Thank you for calling Vantage Lane London — premium chauffeur and concierge.
      Press 1 for bookings and reservations.
      Press 2 for drivers and operations.
      Press 0 for immediate assistance.
      Press 9 to repeat this menu.
    </Say>
  </Gather>
  <Redirect>/menu</Redirect>
</Response>`);
});

// HOLD: loops music while caller is queued
app.all("/hold", (req, res) => {
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${HOLD_URL}</Play>
  <Pause length="1"/>
  <Redirect>/hold</Redirect>
</Response>`);
});

// ROUTER: puts caller in queue (hold music) AND calls agent via <Dial><Sip> (agent joins queue is separate step)
// NOTE: to get true "call agent immediately while caller hears music", we do: enqueue caller and return quickly.
// Agent call must be initiated separately. We'll do it by returning TeXML that calls agent leg first, then enqueues caller.
app.post("/router", (req, res) => {
  const digits = (req.body.Digits || "").trim();

  // choose message
  let dept = "Connecting you now.";
  if (digits === "1") dept = "One moment. Connecting you to bookings and reservations.";
  if (digits === "2") dept = "One moment. Connecting you to drivers and operations.";
  if (digits === "0") dept = "Please hold. Connecting you now.";
  if (digits === "9") {
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect>/menu</Redirect></Response>`);
    return;
  }

  // This returns TeXML that:
  // 1) speaks
  // 2) enqueues caller with waitUrl=hold
  // The agent side will be handled by a second DID/SIP flow (next step once service is live).
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">${dept}</Say>
  <Enqueue waitUrl="/hold" waitUrlMethod="GET">VL-OFFICE-QUEUE</Enqueue>
</Response>`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("listening on", port));
