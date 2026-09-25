import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(port, () => console.log(`api listening on ${port}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
