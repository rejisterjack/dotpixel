const express = require("express")
const bodyParser = require("body-parser")
const { Op } = require("sequelize")
const axios = require("axios")
const db = require("../models")
require("dotenv").config()

const app = express()
app.use(bodyParser.json())

db.sequelize
  .sync({ force: false })
  .then(() => console.log("Database synchronized"))
  .catch((err) => console.error("Failed to synchronize database:", err))

const validateEmail = (email) => /\S+@\S+\.\S+/.test(email)
const validateTags = (tags) =>
  Array.isArray(tags) &&
  tags.length <= 5 &&
  tags.every((tag) => typeof tag === "string" && tag.trim().length > 0)

app.post("/api/users", async (req, res) => {
  const { username, email } = req.body

  if (!username || !email) {
    return res.status(400).json({ message: "Username and email are required." })
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: "Invalid email address." })
  }

  const userExists = await db.user.findOne({ where: { email } })
  if (userExists) {
    return res.status(400).json({ message: "Email already exists." })
  }

  const newUser = await db.user.create({ username, email })
  res.status(201).json({
    message: "User created successfully",
    user: newUser,
  })
})

app.get("/api/photos/search", async (req, res) => {
  const { query } = req.query

  if (!query) {
    return res.status(400).json({ message: "Search term is required." })
  }

  try {
    const response = await axios.get("https://api.unsplash.com/search/photos", {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
      params: { query },
    })

    const photos = response.data.results.map((photo) => ({
      imageUrl: photo.urls.full,
      description: photo.description,
      altDescription: photo.alt_description,
    }))

    if (photos.length === 0) {
      return res
        .status(404)
        .json({ message: "No images found for the given query." })
    }

    res.json({ photos })
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch images from Unsplash." })
  }
})

app.post("/api/photos", async (req, res) => {
  const { imageUrl, description, altDescription, tags, userId } = req.body

  if (!imageUrl || !imageUrl.startsWith("https://images.unsplash.com/")) {
    return res.status(400).json({ message: "Invalid image URL." })
  }
  if (!validateTags(tags)) {
    return res.status(400).json({
      message: "Tags must be an array of up to 5 non-empty strings.",
    })
  }

  const photo = await db.photo.create({ imageUrl, description, altDescription, userId })

  if (tags && tags.length > 0) {
    const tagInstances = tags.map((tag) => ({ name: tag, photoId: photo.id }));
    await db.tag.bulkCreate(tagInstances);
  }

  res.status(201).json({ message: "Photo saved successfully" })
})

app.post("/api/photos/:photoId/tags", async (req, res) => {
  const { photoId } = req.params
  const { tags } = req.body

  if (!validateTags(tags)) {
    return res.status(400).json({
      message: "Tags must be an array of up to 5 non-empty strings.",
    })
  }

  const photo = await db.photo.findByPk(photoId, { include: db.tag })
  if (!photo) {
    return res.status(404).json({ message: "Photo not found." })
  }

  const existingTags = photo.tags || []
  if (existingTags.length + tags.length > 5) {
    return res.status(400).json({
      message: "A photo can have a maximum of 5 tags.",
    })
  }

  await Promise.all(
    tags.map((tag) => db.tag.create({ name: tag, photoId: photo.id }))
  )

  res.status(201).json({ message: "Tags added successfully" })
})

app.get("/api/photos/tag/search", async (req, res) => {
  const { tags, sort = "ASC", userId } = req.query

  if (!tags) {
    return res.status(400).json({ message: "Tag is required." })
  }
  if (!["ASC", "DESC"].includes(sort.toUpperCase())) {
    return res.status(400).json({ message: "Invalid sort order." })
  }

  const tag = await db.tag.findOne({ where: { name: tags } })
  if (!tag) {
    return res.status(404).json({ message: "Tag not found." })
  }

  const photos = await db.photo.findAll({
    where: { id: tag.photoId },
    include: db.tag,
    order: [["dateSaved", sort.toUpperCase()]],
  })

  if (userId) {
    await db.searchHistory.create({ userId, query: tags })
  }

  res.json({
    photos: photos.map((photo) => ({
      imageUrl: photo.imageUrl,
      description: photo.description,
      dateSaved: photo.dateSaved,
      tags: photo.tags.map((t) => t.name),
    })),
  })
})

app.get("/api/search-history", async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." })
  }

  const history = await db.searchHistory.findAll({
    where: { userId },
    order: [["timestamp", "DESC"]],
  })

  res.json({
    searchHistory: history.map((entry) => ({
      query: entry.query,
      timestamp: entry.timestamp,
    })),
  })
})

module.exports = app
