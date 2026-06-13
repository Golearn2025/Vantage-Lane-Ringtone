import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const BASE_URL = process.env.BASE_URL || "https://vantage-lane-ringtone.onrender.com";
const TELNYX_FROM = process.env.TELNYX_FROM_NUMBER || "+442046203131";
const TELNYX_CONNECTION_ID =
  process.env.TELNYX_SIP_CONNECTION_ID || "2872033420802786570";
const HOLD_MUSIC_URL =
  process.env.HOLD_MUSIC_URL ||
  "https://ruskhucrvjvuuzwlboqn.supabase.co/storage/v1/object/public/ringtone/hold-music.mp3";
const DIAL_LEG_TIMEOUT = Number(process.env.DIAL_LEG_TIMEOUT || 20);

const NUM_CATALIN = process.env.TELNYX_NUM_CATALIN || "+442046203133";
const NUM_CRISTI = process.env.TELNYX_NUM_CRISTI || "+442046203134";

// Sequential hunt — one person at a time, then failover via /office/failover.
const ROUTES = {
  "1": [NUM_CATALIN, NUM_CRISTI],
  "2": [NUM_CRISTI, NUM_CATALIN],
  "3": [NUM_CRISTI, NUM_CATALIN],
  "4": [NUM_CATALIN, NUM_CRISTI],
  "0": [NUM_CATALIN, NUM_CRISTI],
};

const FAILOVER_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

const MENU_SAY = `Thank you for calling Vantage Lane London, premium chauffeur and concierge.
      Press 1 for bookings.
      Press 2 for new reservations.
      Press 3 for business enquiries.
      Press 4 for driver support.
      You may also email us at contact at vantage hyphen lane dot com.
      Press 9 to repeat this menu.`;

const UNAVAILABLE_SAY = `We are sorry, no one is available to take your call right now.
      Please email contact at vantage hyphen lane dot com with your enquiry, and we will respond as soon as possible.
      We will also return your call on this number at our earliest opportunity.
      Thank you for calling Vantage Lane. Goodbye.`;

function xml(res, body) {
  res.set("Content-Type", "application/xml");
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

function failoverUrl(chain, step) {
  const params = new URLSearchParams({ chain: chain.join(","), step: String(step) });
  return `${BASE_URL}/office/failover?${params}`;
}

function renderDial(res, chain, step, { intro = false } = {}) {
  const number = chain[step];
  const action = failoverUrl(chain, step);
  const introSay = intro
    ? `  <Say voice="Polly.Amy-Neural">Please hold while I connect you.</Say>\n`
    : "";

  console.log("Dial leg", step + 1, "of", chain.length, "→", number);

  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${introSay}  <Dial callerId="${esc(TELNYX_FROM)}" timeout="${DIAL_LEG_TIMEOUT}" ringTone="${esc(HOLD_MUSIC_URL)}" connectionId="${esc(TELNYX_CONNECTION_ID)}" action="${esc(action)}" method="POST">
    <Number>${esc(number)}</Number>
  </Dial>
  <Say voice="Polly.Amy-Neural">${esc(UNAVAILABLE_SAY)}</Say>
</Response>`
  );
}

function renderUnavailable(res) {
  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">${esc(UNAVAILABLE_SAY)}</Say>
</Response>`
  );
}

app.get("/", (_req, res) => {
  res.type("text").send("OK");
});

app.all("/office/menu", (_req, res) => {
  const routerUrl = `${BASE_URL}/office/router`;
  const menuUrl = `${BASE_URL}/office/menu`;

  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${esc(routerUrl)}" method="POST" numDigits="1" timeout="8" validDigits="123490">
    <Say voice="Polly.Amy-Neural">${esc(MENU_SAY)}</Say>
  </Gather>
  <Redirect method="POST">${esc(menuUrl)}</Redirect>
</Response>`
  );
});

app.all("/office/router", (req, res) => {
  const digits = (req.body?.Digits ?? req.query?.Digits ?? "").toString().trim();
  const menuUrl = `${BASE_URL}/office/menu`;

  console.log("Router digits:", digits, "body:", req.body, "query:", req.query);

  if (digits === "9" || digits === "") {
    return xml(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${esc(menuUrl)}</Redirect>
</Response>`
    );
  }

  const chain = ROUTES[digits];
  if (!chain) {
    return xml(
      res,
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Sorry, I didn't catch that. Please try again.</Say>
  <Redirect method="POST">${esc(menuUrl)}</Redirect>
</Response>`
    );
  }

  renderDial(res, chain, 0, { intro: true });
});

app.all("/office/failover", (req, res) => {
  const status = (req.body?.DialCallStatus ?? req.query?.DialCallStatus ?? "")
    .toString()
    .toLowerCase();
  const chain = (req.query.chain ?? "").split(",").filter(Boolean);
  const step = Number(req.query.step ?? 0);

  console.log("Failover status:", status, "chain:", chain.join(" → "), "step:", step);

  if (status === "completed") {
    return xml(res, `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`);
  }

  if (FAILOVER_STATUSES.has(status)) {
    const next = step + 1;
    if (next < chain.length) {
      return renderDial(res, chain, next);
    }
  }

  return renderUnavailable(res);
});

app.all("/office/hold", (_req, res) => {
  const holdUrl = `${BASE_URL}/office/hold`;

  xml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${esc(HOLD_MUSIC_URL)}</Play>
  <Pause length="1"/>
  <Redirect method="POST">${esc(holdUrl)}</Redirect>
</Response>`
  );
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Vantage Lane IVR on port", port);
  console.log("Hold music:", HOLD_MUSIC_URL);
  console.log("Dial leg timeout:", DIAL_LEG_TIMEOUT, "s");
});
