

module.exports = {
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "watokeper",
  DB: process.env.DB_NAME || "stock",
  dialect: "postgres",
};
