import express from "express";

const app = express();

// Telnyx trimite uneori x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  TELNYX_API_KEY,
  TELNYX_ACCOUNT_SID,
  TELNYX_AGENT_APP_SID,
  TELNYX_AGENT_SIP_URI,
  TELNYX_FROM_NUMBER,
} = process.env;

function xml(res, body) {
  res.set("Content-Type", "text/xml");
  res.status(200).send(body);
}

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Pornim apelul către agent (Zoiper) via TeXML REST:
 * POST /texml/Accounts/{account_sid}/Calls
 * https://developers.telnyx.com/api-reference/texml-rest-commands/initiate-an-outbound-call
 */
async function ringAgent({ menuChoice }) {
  if (!TELNYX_API_KEY || !TELNYX_ACCOUNT_SID || !TELNYX_AGENT_APP_SID || !TELNYX_AGENT_SIP_URI || !TELNYX_FROM_NUMBER) {
    console.log("Missing env vars. Check Render Environment.");
    return;
  }

  const url = `https://api.telnyx.com/texml/Accounts/${TELNYX_ACCOUNT_SID}/Calls`;

  const payload = {
    ApplicationSid: TELNYX_AGENT_APP_SID,
    From: TELNYX_FROM_NUMBER,
    To: TELNYX_AGENT_SIP_URI,
    CallerId: "Vantage Lane",
    // opțional: dacă vrei să override-uiești XML URL doar pentru apelul agentului:
    // Url: "https://vantage-lane-ringtone.onrender.com/agent/bridge",
    // UrlMethod: "GET",
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    console.log("TELNYX TeXML create call:", r.status, text, "choice=", menuChoice);
  } catch (e) {
    console.log("TELNYX create call error:", e?.message || e);
  }
}

/**
 * MENU (inbound)
 */
app.all("/office/menu", (req, res) => {
  const routerUrl = "https://vantage-lane-ringtone.onrender.com/office/router";
  const menuUrl = "https://vantage-lane-ringtone.onrender.com/office/menu";

  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${esc(routerUrl)}" method="POST" numDigits="1" timeout="6" validDigits="1209">
    <Say voice="Polly.Amy-Neural">
      Thank you for calling Vantage Lane London — premium chauffeur and concierge.
      Press 1 for bookings and reservations.
      Press 2 for drivers and operations.
      Press 0 for immediate assistance.
      Press 9 to repeat this menu.
    </Say>
  </Gather>
  <Redirect>${esc(menuUrl)}</Redirect>
</Response>`
  );
});

/**
 * ROUTER (după DTMF)
 * - pornește imediat apelul către agent (async)
 * - pune clientul în coadă cu hold music loop
 */
app.all("/office/router", async (req, res) => {
  const digits = (req.body?.Digits ?? req.query?.Digits ?? "").toString().trim();
  const menuUrl = "https://vantage-lane-ringtone.onrender.com/office/menu";
  const holdUrl = "https://vantage-lane-ringtone.onrender.com/office/hold";

  if (digits === "9" || digits === "") {
    return xml(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${esc(menuUrl)}</Redirect>
</Response>`
    );
  }

  if (!["1", "2", "0"].includes(digits)) {
    return xml(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Sorry, I didn't catch that.</Say>
  <Redirect>${esc(menuUrl)}</Redirect>
</Response>`
    );
  }

  // Important: ring agent NOW (nu după ce se termină melodia)
  ringAgent({ menuChoice: digits });

  // Clientul intră în coadă și aude muzică până răspunzi tu în Zoiper
  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Please hold while I connect you.</Say>
  <Enqueue waitUrl="${esc(holdUrl)}" waitUrlMethod="GET">VL-OFFICE-QUEUE</Enqueue>
</Response>`
  );
});

/**
 * HOLD (muzică în buclă)
 * IMPORTANT: trebuie să accepte GET și POST (Telnyx poate chema și cu POST)
 */
app.all("/office/hold", (req, res) => {
  const music = "https://fmeonuvmlopkutbjejlo.supabase.co/storage/v1/object/public/Ringtone/minimalistic-for-design-201447.mp3";
  const holdUrl = "https://vantage-lane-ringtone.onrender.com/office/hold";

  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${esc(music)}</Play>
  <Pause length="1"/>
  <Redirect>${esc(holdUrl)}</Redirect>
</Response>`
  );
});

/**
 * AGENT BRIDGE (când agentul răspunde în Zoiper)
 * Aici "trage" din coadă și face bridge.
 */
app.all("/agent/bridge", (req, res) => {
  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Queue>VL-OFFICE-QUEUE</Queue>
  </Dial>
</Response>`
  );
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));
