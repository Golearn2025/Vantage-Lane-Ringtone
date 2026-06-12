// ROUTER
app.post("/office/router", (req, res) => {
  const digits = req.body.Digits || req.query.Digits || "";

  console.log("Received digits:", digits, "Body:", req.body, "Query:", req.query);

  xml(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">
    Please hold while I connect you.
  </Say>

  <Dial callerId="${TELNYX_FROM}" timeout="30">
    <Number>+447377714113</Number>
  </Dial>

</Response>`);
});
