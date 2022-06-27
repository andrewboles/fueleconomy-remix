import express from "express";

const app = express();
app.use('/lib/parse/',
  express.static(`node_modules/csv-parse/dist/esm/`));
app.listen(8080);