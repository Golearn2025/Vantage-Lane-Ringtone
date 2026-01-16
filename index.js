import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const ZOIPER_SIP = "sip:vantagelane2026@sip.telnyx.com";
const TELNYX_FROM = "+442046203131";

function xml(res, body) {
  res.set("Content-Type", "application/xml");
  res.status(200).send(body);
}

// MENU
app.post("/office/menu", (req, res) => {
  xml(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="https://vantage-lane-ringtone.onrender.com/office/router" numDigits="1" timeout="6">
    <Say voice="Polly.Amy-Neural">
      Thank you for calling Vantage Lane London, premium chauffeur and concierge.
      Press 1 to speak with Constantin.
      Press 2 to speak with Cristi.
      Press 0 for both agents.
    </Say>
  </Gather>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/menu</Redirect>
</Response>`);
});

// ROUTER
app.post("/office/router", (req, res) => {
  const digits = req.body.Digits || req.query.Digits || "";
  
  console.log("Received digits:", digits, "Body:", req.body, "Query:", req.query);
  
  if (digits === "9" || digits === "") {
    return xml(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/menu</Redirect>
</Response>`);
  }

  let sipUri = "";
  
  if (digits === "1") {
    sipUri = "sip:30010@1588.3cx.cloud"; // Constantin
  } else if (digits === "2") {
    sipUri = "sip:30011@1588.3cx.cloud"; // Cristi
  } else if (digits === "0") {
    sipUri = "sip:30060@1588.3cx.cloud"; // Ring Group (both)
  } else {
    return xml(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Invalid selection. Please try again.</Say>
  <Redirect>https://vantage-lane-ringtone.onrender.com/office/menu</Redirect>
</Response>`);
  }

  xml(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Please hold while I connect you.</Say>
  <Dial callerId="${TELNYX_FROM}" timeout="45">
    <Sip>${sipUri}</Sip>
  </Dial>
  <Say voice="Polly.Amy-Neural">Sorry, no one is available. Goodbye.</Say>
</Response>`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server on", port));
