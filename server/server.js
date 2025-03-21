const { sequelize } = require("./models")
const app = require("./src/app")

const PORT = 3000

sequelize.sync().then(() => {
  console.log("Database synced")
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
