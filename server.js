import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Life Command Center</title></head>
      <body style="font-family: Arial; padding: 24px;">
        <h1>Life Command Center</h1>
        <p>Render deployment is working ✅</p>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log("Server running on port", port);
});
